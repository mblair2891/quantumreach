# Zoom Meeting Provider Integration

Quantum Reach now has a provider-neutral meeting adapter interface with Zoom implemented first. The Prisma model keeps historical Native LiveKit meetings while new workspace meetings default to Zoom when a workspace has a connected Zoom integration.

## OAuth and app setup
Use an admin-managed Zoom General OAuth app with the redirect URI `https://quantumreach.app/api/integrations/zoom/callback`. Required capabilities are the current Zoom scopes for creating meetings for users, listing users, listing cloud recordings, and retrieving recording files.

Workspace admins connect from `/dashboard/settings/integrations/meetings`. The connect route signs state containing workspace ID, user ID, nonce, and expiry. The callback validates state, exchanges the code server-side, encrypts tokens, stores safe account metadata, audits connection, and redirects without exposing tokens.

## Token encryption and refresh
Provider credentials are encrypted with `INTEGRATION_ENCRYPTION_KEY` using versioned AES-256-GCM ciphertext. Zoom access tokens refresh server-side shortly before expiry. Refresh failures mark the integration `ERROR` or `EXPIRED` with reconnect guidance.

## Meeting provider behavior
`MeetingProviderAdapter` supports create, update, cancel, join details, status refresh, artifact listing/download, and token refresh. Zoom maps Quantum Reach title, description, scheduled start, duration, waiting room, cloud recording preference, host, join-before-host, and mute-on-entry to Zoom APIs. Google Meet and Microsoft Teams are represented only by enums/types for future adapters.

## Join and start redirects
Guests use `/api/meetings/[id]/join` after invitation validation and recording-consent checks. Hosts use `/api/meetings/[id]/start`; the encrypted Zoom `start_url` is decrypted only for an authenticated host redirect and is not rendered in page source.

## Waiting room and recording
For Zoom-backed meetings, `lobbyEnabled` maps to Zoom waiting room. Zoom is the runtime authority for admission, recording start/pause/resume/stop, and generated cloud artifacts. Quantum Reach keeps consent and review workflow state.

## Webhooks and artifacts
Production webhook URL: `https://quantumreach.app/api/webhooks/zoom`. The endpoint supports Zoom URL validation and verifies event signatures/timestamp freshness for normal notifications. Supported first events: Meeting has ended, All recordings have completed, and Recording transcript files have completed. Events are idempotently stored in `ProviderWebhookEvent`; artifacts are discovered in `MeetingProviderArtifact` and can be imported to private R2 using workspace/meeting scoped keys without persisting temporary Zoom URLs as playback URLs.

## Transcript-first workflow
Zoom transcript artifacts are preferred. Imported transcripts enter `REVIEW_REQUIRED` and the existing transcript review, approval, CallSession handoff, CRM links, and diagnostic flow remain the authority. If no Zoom transcript is available, existing OpenAI transcription can be used on imported recordings.

## Deployment sequence
1. Set placeholder-free values in Vercel: `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`, `ZOOM_REDIRECT_URI`, and `INTEGRATION_ENCRYPTION_KEY`.
2. Deploy code.
3. Run `npm run prisma:deploy`.
4. In Zoom, save the webhook subscription for `https://quantumreach.app/api/webhooks/zoom`, complete URL validation, and select: Meeting has ended; All recordings have completed; Recording transcript files have completed.

## LiveKit coexistence and future adapters
LiveKit models, records, and routes remain for historical and legacy native meetings. A later phase can remove LiveKit runtime after Zoom production validation. Google/Microsoft adapters can implement the existing provider interface without redesigning workspace integration storage.

## Known limitations
Real Zoom OAuth, cloud recording, transcript, and R2 import must be validated after deployment with production secrets and a Zoom account/plan that permits the requested operations.
