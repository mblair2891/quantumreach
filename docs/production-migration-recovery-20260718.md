# Production migration recovery — 2026-07-18

## Root cause

`20260718120000_managed_email_domain_infrastructure` is recorded as successfully applied in production, but its committed `migration.sql` contains only comments. It therefore created none of the managed email/domain enums, tables, indexes, or foreign keys represented in `prisma/schema.prisma`.

`20260718000000_operationalize_sending` then failed before applying any SQL (`applied_steps_count = 0`) with PostgreSQL error `42704`: `ManagedMailboxStatus` did not exist. Because the failed migration's statements never ran, neither the three `DomainPurchaseRequestStatus` values, `PENDING_PROVIDER_CONFIGURATION`, nor `InfrastructureJob` exist in production.

Do **not** edit `20260718120000_managed_email_domain_infrastructure`. Its checksum is already recorded in production. This repair deliberately replaces only the zero-step failed migration on the not-yet-merged repair branch.

## Repair strategy

This repair uses **Strategy A**. The body of `20260718000000_operationalize_sending` has been replaced with the complete additive schema diff from the schema immediately before the managed infrastructure pass to the current schema. It includes both the missing foundation and operationalization additions.

This is safe only for the documented production state:

- the failed migration record has `applied_steps_count = 0`;
- no statement from that migration persisted;
- the earlier comment-only migration is already recorded as applied; and
- the operator first marks the failed migration as rolled back with Prisma.

The recovery SQL uses guarded type/table/index/constraint creation and additive enum values. It contains no `DROP`, `DELETE`, `TRUNCATE`, reset, or data rewrite. Guards make the expected zero-step recovery rerunnable, but they are not a substitute for investigating any pre-existing incompatible table or type drift.

## Exact production recovery sequence

Run these commands from a controlled maintenance environment using the deployed repair commit. Set `DATABASE_URL` and `DIRECT_DATABASE_URL` through the normal secret mechanism; do not paste credentials into shell history or this document.

1. Pause deployments that invoke `prisma migrate deploy`, take the normal production backup/snapshot, and confirm the migration record is the documented zero-step failure:

   ```sql
   SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
   FROM "_prisma_migrations"
   WHERE migration_name IN (
     '20260718120000_managed_email_domain_infrastructure',
     '20260718000000_operationalize_sending'
   )
   ORDER BY migration_name;
   ```

   Stop and investigate if `20260718000000_operationalize_sending` has any applied steps, a non-null `finished_at`, or if the missing infrastructure objects already exist with an unexpected shape.

2. Confirm Prisma sees the failed migration:

   ```bash
   npx prisma migrate status
   ```

3. Mark **only** the zero-step failed migration rolled back. Do not mark the empty, successfully applied migration as rolled back or applied again:

   ```bash
   npx prisma migrate resolve --rolled-back 20260718000000_operationalize_sending
   ```

4. Apply the corrected migration body:

   ```bash
   npx prisma migrate deploy
   ```

5. Verify the repaired schema contains the principal types and tables:

   ```sql
   SELECT typname
   FROM pg_type
   WHERE typname IN (
     'CommerceProductCategory',
     'CommerceBillingInterval',
     'ProviderReadinessState',
     'ManagedMailboxProviderKey',
     'ManagedMailboxStatus',
     'InfrastructureProvisioningStatus'
   )
   ORDER BY typname;

   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN (
       'CommerceProduct', 'CommerceProductEntitlement', 'SaasSubscriptionItem',
       'InfrastructureEntitlementOverride', 'ManagedMailbox',
       'MailboxProvisioningEvent', 'InfrastructureSenderIdentity',
       'DesiredDnsRecord', 'DnsReconciliationRun', 'InboundEmailMessage',
       'OutboundMessageLedger', 'CampaignSendJob',
       'WorkspaceInfrastructureUsage', 'InfrastructureJob', 'CommissionRule',
       'WorkspaceInfrastructureProvisioning'
     )
   ORDER BY table_name;

   SELECT enumlabel
   FROM pg_enum
   JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
   WHERE typname IN ('DomainPurchaseRequestStatus', 'ManagedMailboxStatus')
   ORDER BY typname, enumsortorder;
   ```

6. Confirm Prisma history is healthy and the corrected migration is finished:

   ```bash
   npx prisma migrate status
   ```

   The status command must report that the database schema is up to date. Re-run the `_prisma_migrations` query from step 1 and verify the repaired migration has a non-null `finished_at` and expected applied steps.

## Checksum and history considerations

Changing a migration file that already has a successful production checksum would cause a checksum conflict, which is why the comment-only `20260718120000` file is untouched. The corrected `20260718000000` body is permissible only after the failed zero-step record is explicitly resolved as rolled back. Prisma then records the checksum for the corrected retry when `migrate deploy` succeeds. Do not use `--applied`, `prisma db push`, `migrate reset`, or manual edits to `_prisma_migrations` for this repair.

## Prevention

`npm run prisma:check-migrations` is run in CI. It rejects new comment-only `migration.sql` files. The historical empty migration is a narrowly documented exception solely to preserve existing production migration history.
