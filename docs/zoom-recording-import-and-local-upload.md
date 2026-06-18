# Zoom recording import and local upload workflow

Quantum Reach supports two intentional recording choices for Zoom-backed meetings: **Record to Zoom cloud** and **Record locally and upload afterward**. Cloud recording depends on the selected Zoom host/account; local recording requires the host to choose **Record to this computer** in Zoom and then upload MP4/M4A or another supported media file after the meeting.

## Cloud recording

Zoom webhooks verify signatures, resolve the stored Zoom meeting, and upsert provider artifacts without downloading media inline. If a webhook is delayed, an authorized user can run the meeting refresh action to list Zoom recording artifacts. The import route refreshes Zoom OAuth server-side, downloads the selected artifact server-side, streams it into the private meeting-recordings R2 bucket, and marks the recording available. Zoom temporary download URLs and OAuth tokens are never returned to the browser.

## Local upload

The browser never proxies large media through Next.js. Quantum Reach validates filename, MIME type, and size, creates a pending `MeetingRecording`, generates a short-lived presigned R2 PUT URL for a server-generated object key, and the browser uploads directly to private R2. Completion verifies the object with a HEAD request before marking it available. Abort marks the upload cancelled.

Supported formats: MP4, M4A, MP3, WAV, WebM, and MOV. `MEETING_RECORDING_MAX_UPLOAD_BYTES` defaults to `5368709120` (5 GiB). Upload size and synchronous transcription size are separate limits; large recordings may require background media processing before automatic transcription.

## Transcript behavior

Zoom transcript artifacts are preferred. Importing a Zoom VTT/text transcript normalizes the text, sets `REVIEW_REQUIRED`, and does not call OpenAI. If no provider transcript exists, an authorized user can request OpenAI transcription for an available local or imported recording. Review and approval use the existing meeting transcript screen and CallSession handoff.

## Protected download

Downloads require workspace access, meeting ownership, an available recording, a storage key, and an existing private R2 object. Missing historical objects return a safe unavailable message instead of a generic 500. Range headers are forwarded for browser playback where supported.

## Security and retention

Every route is workspace and meeting scoped. Storage keys are generated server-side and not shown in the UI. Presigned upload URLs are short-lived and are not audited. Deleting a Quantum Reach Zoom import would not delete the Zoom cloud copy; Zoom-side deletion is out of scope. Approved transcript and CallSession history should not be destroyed silently.

## Deployment

Run the additive Prisma migration before deployment:

```bash
npm run prisma:deploy
```

Then deploy the application with configured Zoom, R2, and OpenAI server environment variables. Do not expose R2, Zoom OAuth, or OpenAI credentials to the browser.

## Operational smoke tests

1. Create a meeting with local upload, upload an M4A/MP4 through the direct R2 flow, complete verification, download through the protected route, transcribe, review, approve, and confirm the CallSession is `TRANSCRIPT_READY`.
2. Create a Zoom cloud meeting with an eligible host, end the meeting, confirm webhook or refresh discovers artifacts, import a media or transcript artifact, review/approve, and confirm the CallSession.
3. Use a host without cloud recording entitlement and confirm the UI guidance recommends local upload without claiming cloud availability.
4. Open a historical recording whose object is missing and confirm the protected route returns a safe unavailable message.

## Known limitations

This build uses user-triggered bounded imports rather than a background worker, so very large Zoom-to-R2 imports can still hit deployment runtime limits. Multi-file local uploads are represented as separate recording rows in the MVP; operators should select the preferred audio file for transcription and keep video for playback/archive.
