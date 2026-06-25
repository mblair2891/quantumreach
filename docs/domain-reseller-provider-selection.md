# domain reseller provider selection

Quantum Reach now includes a managed sending-domain provisioning foundation for purchasing, reselling/leasing, assigning, authenticating, warming, monitoring, and retiring sending domains. Live domain purchasing is disabled until `DOMAIN_PURCHASING_ENABLED=true` and registrar credentials are configured. Live DNS automation is disabled until `DNS_AUTOMATION_ENABLED=true` and Cloudflare credentials are configured. AWS SES domain verification is region-specific and disabled unless AWS SES environment variables are present.

The provider abstraction exists before choosing a registrar, so future providers such as OpenSRS, Enom, ResellerClub, CentralNic, NameSilo, or Cloudflare Registrar can be connected without exposing provider credentials to users.

Workspace-owned or dedicated domains are preferred for serious sending. Shared domains carry deliverability risk. Domain warmup improves risk management but does not guarantee inbox placement. Burned or retired domains must not be reused. Live email sending remains blocked unless suppression, compliance, billing, DNS, SES, sender, and warmup gates pass.
