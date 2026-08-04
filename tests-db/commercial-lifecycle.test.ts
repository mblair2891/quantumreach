import { afterAll, describe, expect, it } from "vitest";import { PrismaClient } from "@prisma/client";import { acceptCommercialTerms } from "@/lib/commercial/service";
const db=new PrismaClient();const suffix=`dbtest-${Date.now()}`;const ids:{workspace?:string;user?:string;order?:string}={};
afterAll(async()=>{if(ids.workspace){await db.auditLog.deleteMany({where:{workspaceId:ids.workspace}});await db.sendingCapacityReservation.deleteMany({where:{workspaceId:ids.workspace}});await db.sendingCapacityLedger.deleteMany({where:{workspaceId:ids.workspace}});await db.mailboxWarmupProfile.deleteMany({where:{workspaceId:ids.workspace}});await db.managedMailbox.deleteMany({where:{workspaceId:ids.workspace}});await db.saasSubscription.deleteMany({where:{workspaceId:ids.workspace}});await db.workspaceMember.deleteMany({where:{workspaceId:ids.workspace}});await db.workspace.deleteMany({where:{id:ids.workspace}})}if(ids.order)await db.customerOrder.deleteMany({where:{id:ids.order}});if(ids.user)await db.userProfile.deleteMany({where:{id:ids.user}});await db.commerceProduct.deleteMany({where:{key:`TEST_LAUNCH_${suffix}`}});await db.commercialCatalogVersion.deleteMany({where:{productKey:`TEST_LAUNCH_${suffix}`}});await db.$disconnect()});
describe("PostgreSQL commercial lifecycle",()=>{it("persists immutable accepted terms and retry-safe capacity",async()=>{const user=await db.userProfile.create({data:{clerkUserId:suffix,email:`${suffix}@example.test`}});ids.user=user.id;const workspace=await db.workspace.create({data:{name:suffix,slug:suffix,ownerId:user.id,members:{create:{userId:user.id,roleKey:"WORKSPACE_OWNER"}}}});ids.workspace=workspace.id;const product=await db.commerceProduct.create({data:{key:`TEST_LAUNCH_${suffix}`,name:"Launch",category:"SENDING_PACKAGE",active:true,metadata:{version:1,slug:"launch",recurringPriceCents:29700,setupFeeCents:75000,effectiveAt:"2026-07-29T00:00:00.000Z"},entitlements:{create:[{entitlementKey:"MAILBOX_ALLOWANCE",integerValue:6},{entitlementKey:"MANAGED_DOMAIN_ALLOWANCE",integerValue:2},{entitlementKey:"MONTHLY_SEND_ALLOWANCE",integerValue:4500}]}}});const order=await db.customerOrder.create({data:{userId:user.id,workspaceId:workspace.id,status:"CHECKOUT_PENDING"}});ids.order=order.id;const accepted=await acceptCommercialTerms({orderId:order.id,productId:product.id},db);await db.commerceProduct.update({where:{id:product.id},data:{metadata:{version:2,slug:"launch",recurringPriceCents:99900,setupFeeCents:75000,effectiveAt:"2026-08-01T00:00:00.000Z"}}});const retry=await acceptCommercialTerms({orderId:order.id,productId:product.id},db);expect((accepted.acceptedCommercialTerms as any).recurringPriceCents).toBe(29700);expect(retry.acceptedCommercialTerms).toEqual(accepted.acceptedCommercialTerms);expect(await db.commercialCatalogVersion.count({where:{productKey:product.key}})).toBe(1);});});

it("repairs isolated setup fixtures idempotently without deleting referenced products or erasing mappings", async () => {
  const { upsertSetupProductDefinitions } = await import("@/lib/sending-infrastructure/operational");
  const keys = [`TEST_STANDARD_SETUP_${suffix}`, `TEST_PRIORITY_SETUP_${suffix}`];
  const definitions = [
    { key: keys[0], name: "Standard", description: "Test standard queue", category: "SETUP_FEE" as const, active: true as const, recurring: false as const, billingInterval: "ONE_TIME" as const, oneTimePriceCents: 0, sortOrder: 10 },
    { key: keys[1], name: "Head of the line", description: "Test priority queue", category: "SETUP_FEE" as const, active: true as const, recurring: false as const, billingInterval: "ONE_TIME" as const, oneTimePriceCents: 25000, sortOrder: 20 },
  ];
  const rollback = new Error("ROLLBACK_SETUP_CATALOG_TEST");
  await expect(db.$transaction(async (tx) => {
    await upsertSetupProductDefinitions(definitions, tx as any);
    const before = await tx.commerceProduct.findMany({ where: { key: { in: keys } }, orderBy: { key: "asc" } });
    expect(before).toHaveLength(2);
    const standard = before.find(product => product.key === keys[0])!;
    const priority = before.find(product => product.key === keys[1])!;
    const referenced = await tx.saasSubscriptionItem.create({ data: { workspaceId: `catalog-isolation-${suffix}`, commerceProductId: standard.id, source: "MANUAL_OPERATOR", status: "ACTIVE" }, select: { id: true, commerceProductId: true } });

    await tx.commerceProduct.update({ where: { id: standard.id }, data: { name: "Incomplete standard", active: false, recurring: true, sortOrder: 999 } });
    await tx.commerceProduct.update({ where: { id: priority.id }, data: { name: "Existing priority", active: false, recurring: true, sortOrder: 998, stripeProductId: "prod_test_preserve", stripePriceId: "price_test_preserve", metadata: { priceCents: 32100, operatorNote: "keep" } } });
    await upsertSetupProductDefinitions(definitions, tx as any);
    await upsertSetupProductDefinitions(definitions, tx as any);

    const products = await tx.commerceProduct.findMany({ where: { key: { in: keys }, category: "SETUP_FEE", active: true }, orderBy: { sortOrder: "asc" } });
    expect(products.map(product => product.key)).toEqual(keys);
    expect(products).toHaveLength(2);
    expect(products.every(product => !product.recurring && product.billingInterval === "ONE_TIME")).toBe(true);
    expect(products.find(product => product.key === keys[1])).toMatchObject({ stripeProductId: "prod_test_preserve", stripePriceId: "price_test_preserve", metadata: expect.objectContaining({ priceCents: 32100, operatorNote: "keep", setupPriorityProduct: true }) });
    expect(await tx.saasSubscriptionItem.findUnique({ where: { id: referenced.id } })).toMatchObject({ commerceProductId: referenced.commerceProductId });
    expect(await tx.commerceProduct.findUnique({ where: { id: referenced.commerceProductId } })).not.toBeNull();
    throw rollback;
  })).rejects.toBe(rollback);
});
