> **LEGACY / DEPRECATED:** Native LiveKit meeting runtime has been retired from active product flows. See `docs/zoom-only-meeting-runtime.md` for the current Zoom-only runtime direction.

# Phase 9A LiveKit meetings

Quantum Reach meetings use a workspace-scoped meeting record, hashed guest invitations, server-authorized participant identities, short-lived LiveKit grants, and a custom LiveKit React room.

## Deployment

Configure these server-side variables:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```

Apply the non-destructive migration with:

```bash
npm run prisma:deploy
```

## Runtime behavior

- The browser requests a token only when Join meeting is selected.
- Camera and microphone preview tracks are stopped before LiveKit connects.
- LiveKit room participants and tracks drive the live grid, participant count, remote audio, and active-speaker state.
- Normal leave updates participant history without ending the room.
- Host and co-host roles can end the Quantum Reach meeting.
- Guests are limited to the meeting associated with a valid, unexpired, non-revoked invitation.

## Current operational limitation

Ending a meeting updates Quantum Reach immediately and connected clients detect the ended state through an authorized status check. This implementation does not call the LiveKit room-management API to force-remove every participant, because the LiveKit server SDK is not part of the approved dependency set.
