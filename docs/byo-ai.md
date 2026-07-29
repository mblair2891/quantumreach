# Subscriber-provided AI

Workspace owners/admins may connect OpenAI, Anthropic, and Gemini when `BYO_AI_ENABLED` and the provider flag are enabled. AES-256-GCM credentials use `AI_CREDENTIAL_ENCRYPTION_KEY`, are tenant-scoped, never returned, and are replaced with a masked suffix in responses. Client users can select only administrator-enabled models and never retrieve credentials. Usage is stored by workspace/provider/model/feature; `subscriberPaid=true` distinguishes subscriber-billed usage from Quantum Reach cost.

Add the actual value directly to your `.env` file or deployment-provider environment settings. Do not paste the secret value into chat.
