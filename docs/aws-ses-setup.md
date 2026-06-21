# AWS SES Setup

Configure `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, and optional `AWS_SES_CONFIGURATION_SET`. Verify SPF, DKIM, DMARC, and any future MAIL FROM records before live sends. SES bounce/complaint webhook handling remains disabled until webhook secrets/signature verification are configured.
