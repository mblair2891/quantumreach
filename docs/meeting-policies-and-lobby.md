> **LEGACY / DEPRECATED:** Native LiveKit meeting runtime has been retired from active product flows. See `docs/zoom-only-meeting-runtime.md` for the current Zoom-only runtime direction.

# Meeting policies and waiting lobby

Quantum Reach meeting creation now includes explicit meeting-level policy options for planned recording and host-controlled lobby admission.

## Creation policy options

- **Record this meeting** prepares the meeting for server-side LiveKit Egress recording and later transcript review.
- **Require recording consent before entry** is enforced whenever recording is planned. The product does not allow hidden or consent-free planned recording.
- **Keep participants in lobby until host admits them** causes non-host participants to wait before LiveKit token issuance.

Existing meetings default to recording off, consent off, and lobby off so legacy links remain joinable.

## Recording consent preparation

When `recordingPlanned` is enabled, the server creates one `MeetingRecording` draft in `CONSENT_REQUIRED` state and records a `RECORDING_CONSENT_PREPARED` meeting event. Duplicate active drafts are prevented. Participant consent rows are created for current participants and lazily created for later participants during status, consent, lobby, or token checks.

## Lobby flow

The join order is:

1. Meeting authorization through workspace membership or a valid signed invitation.
2. Recording consent, when required.
3. Lobby request creation or update as `WAITING`.
4. Host/co-host admit or deny.
5. LiveKit token issuance only after admission.

The assigned host and explicit co-hosts bypass the lobby, but they still must satisfy recording consent.

## Polling and state

The waiting screen polls lobby status every three seconds. The in-room host panel receives lobby summary from the existing meeting status poll and refreshes every five seconds.

## Security model

Lobby entries are scoped by workspace, meeting, and server-generated LiveKit identity. Clients never supply trusted role, workspace, participant, identity, or admission fields. Guests cannot self-admit. Normal authenticated workspace users do not receive host controls.

## Meeting end behavior

Ending a meeting cancels waiting lobby entries and prevents further token issuance. Waiting participants see that the meeting is no longer accepting participants.

## Migration

Apply the schema change with:

```bash
npm run prisma:deploy
```

## Known limitations

This phase uses polling rather than realtime lobby push notifications. Runtime browser/provider validation requires a deployed LiveKit environment.
