# Phase 9A Native Meeting MVP

Quantum Reach owns meeting records, lifecycle, invitations, workspace/CRM links, participant/event tracking, and CallSession continuity. LiveKit Cloud provides WebRTC media transport.

## Environment

Use placeholders only in source-controlled examples:

```bash
LIVEKIT_URL=""
LIVEKIT_API_KEY=""
LIVEKIT_API_SECRET=""
```

Deploy schema changes with:

```bash
npm run prisma:deploy
```

## CallSession decision

Phase 9A defers automatic CallSession creation until a user explicitly links an existing call record. This is the safest MVP path because existing transcript, diagnostic, analysis, and deliverable workflows remain unchanged and no empty transcript records are created implicitly.

## Out of scope

Recording, transcription, live captions, calendar integration, automated emails, waiting rooms, PSTN, and AI assistants are deferred.
