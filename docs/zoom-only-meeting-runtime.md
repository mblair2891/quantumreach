# Zoom-only meeting runtime

Quantum Reach now treats Zoom as the only active meeting runtime for newly created meetings. Workspace Zoom OAuth remains the authority for meeting creation, host selection, start redirects, guest join redirects, waiting-room settings, and Zoom webhook events.

## Host start behavior

The meeting detail page renders **Start in Zoom** as a normal protected Quantum Reach link to `/api/meetings/[id]/start` with `target="_blank"` and `rel="noopener noreferrer"`. The browser opens a new tab, while the original Quantum Reach tab remains open. The server route validates workspace access and host authority, decrypts the Zoom start URL only on the server, audits `zoom.host_start_redirected`, and redirects to Zoom. Raw Zoom start URLs and OAuth tokens are never rendered in page HTML.

## Guest invitation flow

Guest links remain Quantum Reach-managed links such as `/meet/[slug]?invite=...`. Quantum Reach validates the signed invitation, expiry, revocation state, meeting status, provider mapping, and recording-consent requirement before redirecting. Zoom-backed invitations show meeting title, hosted-with-Zoom language, scheduled date/time, invitation display name, a recording disclosure when required, and a **Continue to Zoom** action. The join URL is loaded server-side from `MeetingRoom.providerJoinUrl` and audited with `zoom.guest_join_redirected`.

## Waiting room and recording ownership

For Zoom meetings, `lobbyEnabled` maps to Zoom `waiting_room`; guests wait in Zoom until admitted by the host. Quantum Reach does not create native lobby runtime controls for Zoom meetings. Zoom owns runtime recording; Quantum Reach owns consent capture, artifact discovery/import, transcript review, CallSession handoff, private storage access controls, and audit history.

## Historical LiveKit preservation

Existing `NATIVE_LIVEKIT` meetings remain historical records. Meeting rooms, participants, events, invitations, recordings, segments, transcripts, CallSession links, audit records, and Prisma migrations are preserved. Native room joining, browser token issuance, the LiveKit client room UI, native lobby controls, LiveKit webhook mutation, and Egress start controls are retired for active product flows.

## Removed runtime dependencies and environment requirements

The active runtime no longer installs `livekit-client`, `@livekit/components-react`, or `@livekit/components-styles`. Active `.env.example` requirements for `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` were removed. After this cleanup deployment is verified in production, old LiveKit variables and webhook configuration may be removed from Vercel.

## Webhooks

`/api/webhooks/zoom` remains the active provider webhook. The LiveKit webhook route is removed/retired and should no longer be configured for production mutation.

## Future providers

The provider fields and adapter boundary remain suitable for Google Meet and Microsoft Teams. Future adapters should follow the same pattern: protected Quantum Reach invitation links, server-side provider URL lookup, consent before redirect, provider-owned waiting-room semantics, and provider-specific webhooks.

## Post-deployment cleanup

1. Verify Zoom meeting creation, host start new-tab behavior, guest invitation validation, consent, Zoom waiting room behavior, Zoom webhooks, transcript review, and CallSession handoff.
2. Confirm no LiveKit JavaScript bundle or token endpoint is reachable in current product flows.
3. Remove old LiveKit Vercel variables and LiveKit Cloud webhook settings only after production validation succeeds.
4. Keep legacy migrations and historical data for auditability.
