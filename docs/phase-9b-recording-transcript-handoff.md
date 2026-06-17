> **LEGACY / DEPRECATED:** Native LiveKit meeting runtime has been retired from active product flows. See `docs/zoom-only-meeting-runtime.md` for the current Zoom-only runtime direction.

# Phase 9B Recording, Consent, Transcription, and CallSession Handoff

## Architecture
Quantum Reach meeting recording is workspace-scoped and uses explicit consent records, host-controlled LiveKit Cloud Egress, a dedicated private Cloudflare R2 bucket, OpenAI post-call transcription, transcript review, and CallSession handoff. Recording never starts when a room opens; a host or co-host must request consent and then start recording after all required participants consent.

## Consent flow
The host requests recording consent from the meeting detail page. A `MeetingRecording` draft is created with `CONSENT_REQUIRED`, and every currently connected participant receives a `MeetingRecordingConsent` row. Participants see factual copy explaining that audio, video, and screen sharing may be recorded for the meeting record and transcript workflow and stored in private Quantum Reach recording storage. Joining, remaining in the room, enabling media, invitations, or account terms do not imply consent.

Late participants are allowed into the room but immediately receive the recording disclosure from the room status poll. Phase 9B does not dynamically re-issue LiveKit publish permissions, so the documented safe policy is that a participant who declines must leave and revocation triggers a host-visible stop request path; future work can block media publishing at token issuance after a consent gate.

## Recording statuses
`CONSENT_REQUIRED`, `READY`, `STARTING`, `RECORDING`, `STOPPING`, `PROCESSING`, `AVAILABLE`, `FAILED`, `CANCELLED`, and `DELETED` are persisted. UI labels render these as awaiting consent, ready to record, starting, recording, finalizing, available, and failed where appropriate.

## LiveKit Egress flow
The server module validates `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and the dedicated meeting-recording R2 variables. It starts room-composite MP4 egress with a speaker layout and S3-compatible R2 output. Object keys are server-generated: `workspaces/{workspaceId}/meetings/{meetingId}/recordings/{recordingId}/recording.mp4`. The LiveKit webhook endpoint is `/api/webhooks/livekit`; production should configure `https://quantumreach.app/api/webhooks/livekit` in LiveKit Cloud.

The official `livekit-server-sdk` package could not be installed in this environment due an npm registry 403, so Phase 9B uses LiveKit's authenticated Twirp Egress endpoint with server-generated JWTs. Replace this with the official SDK when package access is available.

## R2 storage and protected access
Meeting recordings use only `MEETING_RECORDINGS_R2_*` variables and never reuse the knowledge bucket. The browser never receives R2 credentials, raw object keys, or public URLs. Download/stream access goes through a workspace-authenticated app route that validates meeting and recording ownership and supports byte ranges.

## Webhooks and reconciliation
The LiveKit webhook verifies the Bearer JWT with the LiveKit API secret and handles repeated egress updates idempotently through recording event keys and provider egress IDs. Out-of-order updates do not regress an `AVAILABLE` recording. Hosts can refresh recording status; no infinite polling loop is implemented.

## Transcription workflow
Successful finalization queues transcription. Because no background job provider is configured, actual processing is exposed as an authorized Start/Retry transcription action. OpenAI transcription uses `MEETING_TRANSCRIPTION_MODEL` with default `gpt-4o-mini-transcribe`. Recording bytes are loaded server-side only.

## Size/runtime limitation
The Vercel-safe synchronous MVP rejects recordings over 24 MiB with: “This recording is too large for automatic transcription in the current processing environment.” Large-recording chunking or a durable job runner is deferred.

## Review, approval, and CallSession handoff
Generated transcripts enter `REVIEW_REQUIRED`; reviewers can edit drafts and must explicitly approve before handoff. Approval creates or updates one linked CallSession, preserves CRM links from the meeting, sets transcript source to `meeting_recording:{recordingId}`, advances CallSession to `TRANSCRIPT_READY`, and does not create a diagnostic automatically. Existing manual CallSession transcripts are not overwritten silently.

## Retention and deletion
Active/processing recordings cannot be deleted. Approved or CallSession-linked recordings preserve source history and cannot be hard-deleted through Phase 9B. Failed or unused recordings may be marked deleted after R2 object deletion succeeds.

## Deployment sequence
1. Deploy code.
2. Run `npm run prisma:deploy`.
3. Confirm Vercel has placeholder-free values for all LiveKit, OpenAI, and meeting R2 variables.
4. Configure LiveKit Cloud webhook URL: `https://quantumreach.app/api/webhooks/livekit`.
5. Run a production host/guest test.

## Deferred features
Native background transcription worker, audio-only egress output/chunking, dynamic LiveKit media permission gating for late joiners, explicit post-meeting guest recording sharing, retention schedules, and reopen-approved-transcript workflow.

## Segmented pause/resume recording repair

LiveKit Egress does not provide a native MP4 pause/resume operation. Quantum Reach therefore implements Pause and Resume as multiple finalized Egress segments under one logical `MeetingRecording` session.

- Start creates segment 1 and writes to `workspaces/{workspaceId}/meetings/{meetingId}/recordings/{recordingId}/segments/1/recording.mp4`.
- Pause stops and finalizes the active Egress segment, leaves the LiveKit room connected, and marks the logical recording paused after the provider finalizes the segment.
- Resume rechecks participant consent, creates the next numbered segment, and starts a new RoomComposite Egress with a unique storage key.
- Stop finalizes the active segment or, when already paused, completes the logical recording without stopping the meeting.
- The host timer is based on completed segment duration plus the currently active segment start timestamp. Paused/finalizing time is excluded.
- Paused recordings produce multiple protected recording files (Recording part 1, Recording part 2, etc.); Quantum Reach does not expose public R2 URLs or raw object keys.
- Transcription runs only after final Stop and all usable segments are available. Segments are transcribed in `segmentNumber` order and merged into one transcript review and one CallSession handoff. The 24 MiB synchronous transcription limit applies per segment.
- Deployments must run the additive Prisma migration before using segmented recording controls: `npm run prisma:deploy`.
- Known limitation: this repair does not concatenate MP4 binaries into a combined playable file inside Vercel; users download individual protected parts.
