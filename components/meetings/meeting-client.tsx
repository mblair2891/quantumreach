"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useSpeakingParticipants,
  useTracks
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Camera, CameraOff, LogOut, Mic, MicOff, MonitorUp, PhoneOff, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MeetingClientProps = {
  meeting: { id: string; title: string; description?: string | null; scheduledAt?: string | null };
  invitationToken?: string;
  defaultDisplayName?: string;
  dashboardReturnUrl?: string;
  workspaceId?: string;
};

type Access = {
  token: string;
  url: string;
  identity: string;
  displayName: string;
  role: "HOST" | "CO_HOST" | "PARTICIPANT" | "GUEST";
  meeting: { id: string; title: string; status: string };
};

type LobbyStatus = { lobbyEnabled: boolean; bypass: boolean; status: string | null; displayName: string; meetingStatus: string; waitingCount: number; entries: { id: string; displayName: string; email?: string | null; role: string; status: string; requestedAt: string; consentStatus: string }[] };

type RecordingRoomStatus = {
  meetingStatus?: string;
  recording: { id: string; status: string; transcriptionStatus?: string; startedAt?: string | null; stoppedAt?: string | null; completedAt?: string | null; safeFailureMessage?: string | null } | null;
  currentParticipantConsent: { status: string; respondedAt?: string | null } | null;
  consentSummary: { required: boolean; consented: number; pending: number; declined: number; revoked: number; participants: { displayName: string; role: string; status: string }[] };
  lobby?: LobbyStatus;
  permissions: { canRequestConsent: boolean; canStartRecording: boolean; canStopRecording: boolean; canRefreshRecording: boolean };
};

type DeviceChoice = {
  displayName: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  cameraDeviceId: string;
  microphoneDeviceId: string;
};

function readableMediaError(error: unknown, kind?: MediaDeviceKind) {
  const name = error instanceof DOMException ? error.name : "";
  if (!window.isSecureContext) return "Camera and microphone access require a secure browser context.";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return `${kind === "videoinput" ? "Camera" : kind === "audioinput" ? "Microphone" : "Media"} permission was denied. Update browser permissions and try again.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return kind === "videoinput" ? "No camera was found." : kind === "audioinput" ? "No microphone was found." : "No camera or microphone was found.";
  if (name === "NotReadableError") return "The selected device is already in use or unavailable.";
  return "The selected camera or microphone could not be started.";
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function PreJoin({
  meeting,
  defaultDisplayName,
  onJoin,
  onLobby,
  invitationToken
}: {
  meeting: MeetingClientProps["meeting"];
  defaultDisplayName?: string;
  invitationToken?: string;
  onJoin: (choice: DeviceChoice) => Promise<void>;
  onLobby: (choice: DeviceChoice) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number>();
  const [displayName, setDisplayName] = useState(defaultDisplayName ?? "");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<RecordingRoomStatus | null>(null);
  const [declined, setDeclined] = useState(false);
  const consentRequired = Boolean(recordingStatus?.recording && ["CONSENT_REQUIRED", "READY", "STARTING"].includes(recordingStatus.recording.status) && recordingStatus.currentParticipantConsent?.status !== "CONSENTED");

  const cleanup = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = undefined;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startPreview = useCallback(async () => {
    cleanup();
    setError(undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(window.isSecureContext ? "This browser does not support camera and microphone access." : "Camera and microphone access require a secure browser context.");
      return;
    }
    if (!cameraEnabled && !microphoneEnabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraEnabled ? { deviceId: cameraDeviceId ? { exact: cameraDeviceId } : undefined } : false,
        audio: microphoneEnabled ? { deviceId: microphoneDeviceId ? { exact: microphoneDeviceId } : undefined } : false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextCameras = devices.filter((device) => device.kind === "videoinput");
      const nextMicrophones = devices.filter((device) => device.kind === "audioinput");
      setCameras(nextCameras);
      setMicrophones(nextMicrophones);
      if (!cameraDeviceId && nextCameras[0]) setCameraDeviceId(nextCameras[0].deviceId);
      if (!microphoneDeviceId && nextMicrophones[0]) setMicrophoneDeviceId(nextMicrophones[0].deviceId);
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const context = new AudioContext();
        audioContextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(new MediaStream([audioTrack])).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const measure = () => {
          analyser.getByteFrequencyData(samples);
          setMicrophoneLevel(Math.min(100, Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length)));
          animationRef.current = requestAnimationFrame(measure);
        };
        measure();
      }
    } catch (previewError) {
      setError(readableMediaError(previewError));
    }
  }, [cameraDeviceId, cameraEnabled, cleanup, microphoneDeviceId, microphoneEnabled]);

  useEffect(() => {
    void startPreview();
    return cleanup;
  }, [startPreview, cleanup]);

  async function refreshPreJoinStatus(name = displayName) {
    if (!name.trim()) return null;
    const response = await fetch(`/api/meetings/${meeting.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationToken, displayName: name.trim() })
    });
    const data = await response.json() as RecordingRoomStatus & { error?: string };
    if (!response.ok) throw new Error(data.error || "Meeting status is unavailable.");
    setRecordingStatus(data);
    return data;
  }

  async function answerPreJoinConsent(consent: boolean) {
    if (!recordingStatus?.recording) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/meetings/${meeting.id}/recordings/${recordingStatus.recording.id}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationToken, displayName: displayName.trim(), consent })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Recording consent could not be saved.");
      if (!consent) { setDeclined(true); setBusy(false); return; }
      await refreshPreJoinStatus(displayName);
      if (recordingStatus?.lobby?.lobbyEnabled && !recordingStatus.lobby.bypass) {
        cleanup();
        await onLobby({ displayName: displayName.trim(), cameraEnabled, microphoneEnabled, cameraDeviceId, microphoneDeviceId });
        return;
      }
      cleanup();
      await onJoin({ displayName: displayName.trim(), cameraEnabled, microphoneEnabled, cameraDeviceId, microphoneDeviceId });
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "Recording consent could not be saved.");
      setBusy(false);
    }
  }

  async function join(consentAlreadyChecked = false) {
    if (!displayName.trim()) {
      setError("Enter your display name before joining.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const latest = consentAlreadyChecked ? recordingStatus : await refreshPreJoinStatus(displayName);
      if (latest?.recording && ["CONSENT_REQUIRED", "READY", "STARTING"].includes(latest.recording.status) && latest.currentParticipantConsent?.status !== "CONSENTED") {
        setBusy(false);
        return;
      }
      if (recordingStatus?.lobby?.lobbyEnabled && !recordingStatus.lobby.bypass) {
        cleanup();
        await onLobby({ displayName: displayName.trim(), cameraEnabled, microphoneEnabled, cameraDeviceId, microphoneDeviceId });
        return;
      }
      if (latest?.lobby?.lobbyEnabled && !latest.lobby.bypass) {
        cleanup();
        await onLobby({ displayName: displayName.trim(), cameraEnabled, microphoneEnabled, cameraDeviceId, microphoneDeviceId });
        return;
      }
      cleanup();
      await onJoin({ displayName: displayName.trim(), cameraEnabled, microphoneEnabled, cameraDeviceId, microphoneDeviceId });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Meeting access could not be requested.");
      setBusy(false);
      void startPreview();
    }
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        <div className="relative aspect-video bg-slate-950">
          {cameraEnabled ? <video ref={videoRef} muted playsInline className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><div className="rounded-full bg-slate-800 p-8 text-3xl font-semibold">{displayName.trim().slice(0, 2).toUpperCase() || "QR"}</div></div>}
          <div className="absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1 text-sm">Preview</div>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm font-medium text-blue-300">Quantum Reach Meetings</p>
        <h1 className="mt-2 text-2xl font-semibold">{meeting.title}</h1>
        {meeting.description ? <p className="mt-2 text-sm text-slate-300">{meeting.description}</p> : null}
        {meeting.scheduledAt ? <p className="mt-2 text-xs text-slate-400">{new Date(meeting.scheduledAt).toLocaleString()}</p> : null}
        <div className="mt-6 space-y-4">
          <label className="grid gap-1 text-sm">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">Camera<select value={cameraDeviceId} onChange={(event) => setCameraDeviceId(event.target.value)} disabled={!cameraEnabled} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><option value="">Default camera</option>{cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Microphone<select value={microphoneDeviceId} onChange={(event) => setMicrophoneDeviceId(event.target.value)} disabled={!microphoneEnabled} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><option value="">Default microphone</option>{microphones.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></label>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${microphoneEnabled ? microphoneLevel : 0}%` }} /></div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setMicrophoneEnabled((enabled) => !enabled)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm", microphoneEnabled ? "border-slate-700" : "border-red-500/50 bg-red-500/10 text-red-200")}>{microphoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{microphoneEnabled ? "Microphone on" : "Microphone off"}</button>
            <button type="button" onClick={() => setCameraEnabled((enabled) => !enabled)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm", cameraEnabled ? "border-slate-700" : "border-red-500/50 bg-red-500/10 text-red-200")}>{cameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}{cameraEnabled ? "Camera on" : "Camera off"}</button>
          </div>
          {consentRequired ? <div className="rounded-2xl border border-blue-400/40 bg-blue-500/10 p-4 text-sm text-blue-50"><p className="font-semibold">This meeting may be recorded</p><ul className="mt-2 list-disc space-y-1 pl-5 text-blue-100"><li>Recording may include audio, video, and screen sharing.</li><li>The recording may be used to create a meeting transcript.</li><li>The transcript may enter the Quantum Reach CallSession and diagnostic workflow.</li><li>Recording is stored privately.</li><li>Consent applies to this recording instance.</li></ul><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void answerPreJoinConsent(true)} disabled={busy} className="rounded-lg bg-blue-500 px-3 py-2 font-medium text-white">I consent and continue</button><button type="button" onClick={() => void answerPreJoinConsent(false)} disabled={busy} className="rounded-lg border border-blue-200/50 px-3 py-2 font-medium text-blue-50">I do not consent</button></div></div> : null}
          {declined ? <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">You chose not to consent to this recording, so you cannot join while recording consent is required.<div className="mt-3"><button type="button" onClick={() => { setDeclined(false); setRecordingStatus(null); }} className="rounded-lg border border-amber-200/50 px-3 py-1">Return</button></div></div> : null}
          {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
          <Button type="button" onClick={() => void join()} disabled={busy || consentRequired || declined} className="w-full bg-blue-500 text-white hover:bg-blue-400">{busy ? "Requesting access…" : "Join meeting"}</Button>
          <p className="text-xs leading-5 text-slate-400">Your browser may ask for camera and microphone permission. You can join with either device disabled.</p>
        </div>
      </section>
    </div>
  </main>;
}

function participantRole(metadata?: string) {
  try {
    const value = JSON.parse(metadata ?? "{}") as { role?: string };
    return value.role?.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Participant";
  } catch {
    return "Participant";
  }
}

function ParticipantGrid() {
  const participants = useParticipants();
  const speaking = useSpeakingParticipants();
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const activeIds = new Set(speaking.map((participant) => participant.identity));
  const activeScreen = screenTracks.find((track) => track.publication && !track.publication.isMuted);

  const tiles = participants.map((participant) => {
    const camera = cameraTracks.find((track) => track.participant.identity === participant.identity);
    const hasVideo = Boolean(camera && camera.publication && !camera.publication.isMuted);
    return <div key={participant.identity} className={cn("relative aspect-video overflow-hidden rounded-2xl border bg-slate-900", activeIds.has(participant.identity) ? "border-blue-400 ring-2 ring-blue-400/30" : "border-slate-800")}>
      {hasVideo && camera && camera.publication ? <VideoTrack trackRef={camera} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><div className="rounded-full bg-slate-800 px-6 py-5 text-2xl font-semibold">{(participant.name || "Participant").slice(0, 2).toUpperCase()}</div></div>}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-sm">
        <span>{participant.name || "Participant"}{participant.isLocal ? " (You)" : ""}<span className="ml-2 text-xs text-slate-300">{participantRole(participant.metadata)}</span></span>
        <span className="flex items-center gap-2">{participant.isMicrophoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-300" />}{participant.isCameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4 text-red-300" />}</span>
      </div>
    </div>;
  });

  if (activeScreen) {
    return <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="overflow-hidden rounded-2xl border border-blue-400/40 bg-black"><VideoTrack trackRef={activeScreen} className="h-full max-h-[72vh] w-full object-contain" /></div>
      <div className="grid content-start gap-3 overflow-auto">{tiles}</div>
    </div>;
  }
  return <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 gap-4 overflow-auto sm:grid-cols-2 xl:grid-cols-3">{tiles}</div>;
}

function connectionLabel(state: ConnectionState) {
  if (state === ConnectionState.Connected) return "Connected";
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) return "Reconnecting";
  if (state === ConnectionState.Connecting) return "Connecting";
  return "Disconnected";
}

function RoomExperience({
  meeting,
  access,
  invitationToken,
  onExit,
  onFailure,
  propsWorkspaceId
}: {
  meeting: MeetingClientProps["meeting"];
  access: Access;
  invitationToken?: string;
  onExit: (ended: boolean) => void;
  onFailure: (message: string) => void;
  propsWorkspaceId?: string;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [controlError, setControlError] = useState<string>();
  const [roomStatus, setRoomStatus] = useState<RecordingRoomStatus | null>(null);
  const recording = roomStatus?.recording ?? null;
  const currentConsent = roomStatus?.currentParticipantConsent?.status;
  const [busy, setBusy] = useState(false);
  const previousShare = useRef(false);
  const intentionalLeave = useRef(false);
  const hasConnected = useRef(false);

  const postEvent = useCallback(async (type: string, eventId?: string, keepalive = false) => {
    await fetch(`/api/meetings/${meeting.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, eventId, invitationToken, displayName: access.displayName }),
      keepalive
    });
  }, [access.displayName, invitationToken, meeting.id]);

  useEffect(() => {
    if (connectionState === ConnectionState.Connected && !hasConnected.current) {
      hasConnected.current = true;
      void postEvent("PARTICIPANT_JOINED");
    }
  }, [connectionState, postEvent]);

  useEffect(() => {
    if (isScreenShareEnabled !== previousShare.current) {
      previousShare.current = isScreenShareEnabled;
      void postEvent(isScreenShareEnabled ? "SCREEN_SHARE_STARTED" : "SCREEN_SHARE_STOPPED", crypto.randomUUID());
    }
  }, [isScreenShareEnabled, postEvent]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/meetings/${meeting.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitationToken, displayName: access.displayName })
        });
        const data = await response.json() as RecordingRoomStatus & { status?: string };
        if (!cancelled) setRoomStatus(data);
        if (data.status === "ENDED") {
          intentionalLeave.current = true;
          await room.disconnect(true);
          onExit(true);
        }
      } catch {
        // A transient status check failure should not interrupt an active room.
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [access.displayName, invitationToken, meeting.id, onExit, room]);

  useEffect(() => {
    const pagehide = () => {
      if (!intentionalLeave.current) void postEvent("PARTICIPANT_LEFT", undefined, true);
    };
    window.addEventListener("pagehide", pagehide);
    return () => window.removeEventListener("pagehide", pagehide);
  }, [postEvent]);

  async function runControl(action: () => Promise<unknown>, fallback: string) {
    setControlError(undefined);
    try {
      await action();
    } catch {
      setControlError(fallback);
    }
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    intentionalLeave.current = true;
    await room.disconnect(true);
    await postEvent("PARTICIPANT_LEFT").catch(() => undefined);
    onExit(false);
  }

  async function end() {
    if (!window.confirm("End this meeting for all participants?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/meetings/${meeting.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: access.displayName })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The meeting could not be ended.");
      intentionalLeave.current = true;
      await room.disconnect(true);
      onExit(true);
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "The meeting could not be ended.");
      setBusy(false);
    }
  }


  async function respondConsent(consent: boolean) {
    if (!recording) return;
    const response = await fetch(`/api/meetings/${meeting.id}/recordings/${recording.id}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationToken, displayName: access.displayName, consent })
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) setControlError(data.error || "Recording consent could not be saved.");
    setRoomStatus((current) => current ? { ...current, currentParticipantConsent: { status: consent ? "CONSENTED" : "DECLINED" } } : current);
    if (!consent) { await leave(); }
  }
  async function recordingAction(path: string, body: Record<string, unknown> = {}) {
    setBusy(true); setControlError(undefined);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Recording action failed.");
      const statusResponse = await fetch(`/api/meetings/${meeting.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationToken, displayName: access.displayName }) });
      if (statusResponse.ok) setRoomStatus(await statusResponse.json() as RecordingRoomStatus);
    } catch (error) { setControlError(error instanceof Error ? error.message : "Recording action failed."); }
    finally { setBusy(false); }
  }

  async function lobbyAction(entryId: string, action: "admit" | "deny") {
    const response = await fetch(`/api/meetings/${meeting.id}/lobby/${entryId}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: access.displayName }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setControlError(data.error || `Participant could not be ${action === "admit" ? "admitted" : "denied"}.`);
  }

  async function revokeConsent() {
    if (!recording) return;
    await fetch(`/api/meetings/${meeting.id}/recordings/${recording.id}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationToken, displayName: access.displayName }) });
    setRoomStatus((current) => current ? { ...current, currentParticipantConsent: { status: "REVOKED" } } : current);
  }

  useEffect(() => {
    if (
      connectionState === ConnectionState.Disconnected &&
      hasConnected.current &&
      !intentionalLeave.current
    ) {
      onFailure("The meeting connection was interrupted. You can retry safely.");
    }
  }, [connectionState, onFailure]);

  return <div className="flex min-h-screen flex-col bg-slate-950 p-3 text-slate-50 md:p-5">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div><h1 className="font-semibold">{meeting.title}</h1><p className="text-xs text-slate-400">{connectionLabel(connectionState)} · {access.role.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</p></div>
      <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-sm"><Users className="h-4 w-4" />{participants.length}</div>{(access.role === "HOST" || access.role === "CO_HOST") && roomStatus?.lobby?.waitingCount ? <div className="rounded-full bg-violet-500 px-3 py-1 text-sm font-semibold text-white">Lobby {roomStatus.lobby.waitingCount}</div> : null}{recording ? <div className="rounded-full bg-slate-800 px-3 py-1 text-sm">{recording.status === "RECORDING" ? "Recording active" : "Planned recording"}</div> : null}</div>
    </header>
    {recording?.status === "RECORDING" ? <div className="mb-3 rounded-full bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">● Recording</div> : null}
    {recording && ["STOPPING", "PROCESSING"].includes(recording.status) ? <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">Recording finalizing…</div> : null}
    {access.role === "HOST" || access.role === "CO_HOST" ? <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Recording controls</p><p className="text-slate-400">{recording ? recording.status.replaceAll("_", " ").toLowerCase() : "No recording request"}</p></div><div className="flex flex-wrap gap-2">{roomStatus?.permissions.canRequestConsent ? <button disabled={busy || !propsWorkspaceId} onClick={() => void recordingAction(`/api/meetings/${meeting.id}/recordings`, { workspaceId: propsWorkspaceId })} className="rounded-lg bg-blue-500 px-3 py-2 font-medium text-white">Request recording consent</button> : null}{roomStatus?.permissions.canStartRecording && recording ? <button disabled={busy} onClick={() => void recordingAction(`/api/meetings/${meeting.id}/recordings/${recording.id}/start`, { workspaceId: propsWorkspaceId })} className="rounded-lg bg-blue-500 px-3 py-2 font-medium text-white">Start recording</button> : null}{roomStatus?.permissions.canStopRecording && recording ? <button disabled={busy} onClick={() => void recordingAction(`/api/meetings/${meeting.id}/recordings/${recording.id}/stop`, { workspaceId: propsWorkspaceId })} className="rounded-lg border border-red-300/60 px-3 py-2 font-medium text-red-100">Stop recording</button> : null}{roomStatus?.permissions.canRefreshRecording && recording ? <button disabled={busy} onClick={() => void recordingAction(`/api/meetings/${meeting.id}/recordings/${recording.id}/refresh`, { workspaceId: propsWorkspaceId })} className="rounded-lg border border-slate-600 px-3 py-2">Refresh status</button> : null}</div></div>{roomStatus?.consentSummary ? <p className="mt-3 text-slate-300">Consent: {roomStatus.consentSummary.consented} consented · {roomStatus.consentSummary.pending} pending · {roomStatus.consentSummary.declined} declined · {roomStatus.consentSummary.revoked} revoked</p> : null}{roomStatus?.consentSummary?.participants.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{roomStatus.consentSummary.participants.map((p) => <span key={`${p.displayName}:${p.status}`} className="rounded-lg bg-slate-800 px-2 py-1 text-xs">{p.displayName}: {p.status.toLowerCase()}</span>)}</div> : null}{recording?.safeFailureMessage ? <p className="mt-3 rounded-lg bg-amber-500/10 p-2 text-amber-100">{recording.safeFailureMessage}</p> : null}</div> : null}
    {(access.role === "HOST" || access.role === "CO_HOST") && roomStatus?.lobby?.lobbyEnabled ? <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm">
      <p className="font-semibold">Waiting lobby</p>
      <p className="text-slate-400">{roomStatus.lobby.waitingCount} waiting participant{roomStatus.lobby.waitingCount === 1 ? "" : "s"}</p>
      <div className="mt-3 grid gap-2">
        {roomStatus.lobby.entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-800 p-3">
          <div><p className="font-medium">{entry.displayName}</p><p className="text-xs text-slate-400">{entry.email || "Guest/authenticated participant"} · {entry.role.toLowerCase()} · consent {entry.consentStatus.toLowerCase()}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void lobbyAction(entry.id, "admit")} className="rounded-lg bg-emerald-500 px-3 py-2 font-medium text-white">Admit</button><button type="button" onClick={() => void lobbyAction(entry.id, "deny")} className="rounded-lg border border-red-300/60 px-3 py-2 text-red-100">Deny</button></div>
        </div>)}
        {roomStatus.lobby.entries.length === 0 ? <p className="text-slate-400">No one is waiting.</p> : null}
      </div>
    </div> : null}

    {recording && ["CONSENT_REQUIRED", "READY", "STARTING"].includes(recording.status) && currentConsent !== "CONSENTED" ? <div className="mb-4 rounded-xl border border-blue-400/40 bg-blue-500/10 p-4 text-sm text-blue-50"><p className="font-semibold">Recording consent requested</p><p className="mt-1 text-blue-100">This Quantum Reach meeting may record audio, video, and screen sharing for the meeting record and transcript workflow. The recording is stored in private Quantum Reach recording storage.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void respondConsent(true)} className="rounded-lg bg-blue-500 px-3 py-2 font-medium text-white">I consent to recording</button><button type="button" onClick={() => void respondConsent(false)} className="rounded-lg border border-blue-200/50 px-3 py-2 font-medium text-blue-50">I do not consent</button></div></div> : null}
    {recording?.status === "RECORDING" ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100"><span className="font-semibold">● Recording is active. Audio, video, and screen sharing may be recorded.</span><button type="button" onClick={() => void revokeConsent()} className="rounded-lg border border-red-200/50 px-3 py-1">Revoke consent</button></div> : null}
    {connectionState === ConnectionState.Reconnecting || connectionState === ConnectionState.SignalReconnecting ? <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">Connection interrupted. Reconnecting…</div> : null}
    {controlError ? <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{controlError}</div> : null}
    <ParticipantGrid />
    <RoomAudioRenderer />
    <StartAudio label="Enable meeting audio" className="fixed left-1/2 top-20 z-20 -translate-x-1/2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white" />
    <footer className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-3">
      <button type="button" aria-label="Toggle microphone" onClick={() => void runControl(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled), "The microphone could not be updated.")} className={cn("rounded-xl p-3", isMicrophoneEnabled ? "bg-slate-800" : "bg-red-500/20 text-red-200")}>{isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
      <button type="button" aria-label="Toggle camera" onClick={() => void runControl(() => localParticipant.setCameraEnabled(!isCameraEnabled), "The camera could not be updated.")} className={cn("rounded-xl p-3", isCameraEnabled ? "bg-slate-800" : "bg-red-500/20 text-red-200")}>{isCameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}</button>
      <button type="button" aria-label="Toggle screen share" onClick={() => void runControl(() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled), "Screen sharing was canceled or could not be started.")} className={cn("rounded-xl p-3", isScreenShareEnabled ? "bg-blue-500 text-white" : "bg-slate-800")}><MonitorUp className="h-5 w-5" /></button>
      <button type="button" onClick={leave} disabled={busy} className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-medium text-white"><LogOut className="h-5 w-5" />Leave</button>
      {access.role === "HOST" || access.role === "CO_HOST" ? <button type="button" onClick={end} disabled={busy} className="flex items-center gap-2 rounded-xl border border-red-400/50 px-4 py-3 text-sm font-medium text-red-200"><PhoneOff className="h-5 w-5" />End meeting</button> : null}
    </footer>
  </div>;
}

export function MeetingClient(props: MeetingClientProps) {
  const [choice, setChoice] = useState<DeviceChoice>();
  const [access, setAccess] = useState<Access>();
  const [state, setState] = useState<"preparing" | "lobby" | "requesting" | "connecting" | "connected" | "disconnected" | "failed" | "ended">("preparing");
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus | null>(null);
  const [error, setError] = useState<string>();
  const requestRef = useRef<Promise<void> | null>(null);

  const requestAccess = useCallback(async (nextChoice: DeviceChoice) => {
    if (requestRef.current) return requestRef.current;
    const request = (async () => {
      setChoice(nextChoice);
      setState("requesting");
      setError(undefined);
      const response = await fetch(`/api/meetings/${props.meeting.id}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationToken: props.invitationToken, displayName: nextChoice.displayName })
      });
      const data = await response.json() as Access & { error?: string };
      if (!response.ok) throw new Error(data.error || "Meeting access could not be granted.");
      setAccess(data);
      setState("connecting");
    })();
    requestRef.current = request;
    try {
      await request;
    } finally {
      requestRef.current = null;
    }
  }, [props.invitationToken, props.meeting.id]);

  const enterLobby = useCallback(async (nextChoice: DeviceChoice) => {
    setChoice(nextChoice);
    setState("lobby");
    const response = await fetch(`/api/meetings/${props.meeting.id}/lobby/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationToken: props.invitationToken, displayName: nextChoice.displayName }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Lobby access could not be requested."); setState("failed"); return; }
  }, [props.invitationToken, props.meeting.id]);

  useEffect(() => {
    if (state !== "lobby" || !choice) return;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/meetings/${props.meeting.id}/lobby/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationToken: props.invitationToken, displayName: choice.displayName }) });
        const data = await response.json() as LobbyStatus & { error?: string };
        if (!response.ok) throw new Error(data.error || "Lobby status is unavailable.");
        if (cancelled) return;
        setLobbyStatus(data);
        if (data.meetingStatus === "ENDED" || data.meetingStatus === "CANCELED") { setError("This meeting is no longer accepting participants."); setState("failed"); return; }
        if (data.status === "ADMITTED") await requestAccess(choice);
      } catch (lobbyError) { if (!cancelled) setError(lobbyError instanceof Error ? lobbyError.message : "Lobby status is unavailable."); }
      finally { inFlight = false; }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [choice, props.invitationToken, props.meeting.id, requestAccess, state]);

  if (state === "failed") return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><RefreshCw className="mx-auto h-7 w-7 text-blue-300" /><h1 className="mt-3 text-xl font-semibold">Connection interrupted</h1><p className="mt-2 text-sm text-slate-300">{error}</p><Button className="mt-5" onClick={() => { setAccess(undefined); setChoice(undefined); setState("preparing"); setError(undefined); }}>Return to pre-join</Button></div></div>;

  if (state === "lobby" && choice) return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><Users className="mx-auto h-8 w-8 text-violet-300" /><h1 className="mt-3 text-2xl font-semibold">Waiting for the host to admit you.</h1><p className="mt-2 text-sm text-slate-300">{props.meeting.title}</p><p className="mt-1 text-sm text-slate-400">{choice.displayName} · {lobbyStatus?.status?.toLowerCase() ?? "waiting"}</p>{lobbyStatus?.status === "DENIED" ? <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">You were not admitted to this meeting.</p> : null}<Button className="mt-5" variant="outline" onClick={() => { void fetch(`/api/meetings/${props.meeting.id}/lobby/leave`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationToken: props.invitationToken, displayName: choice.displayName }) }); setChoice(undefined); setState("preparing"); }}>Leave lobby</Button></div></div>;

  if (!access || !choice) {
    return <PreJoin meeting={props.meeting} defaultDisplayName={props.defaultDisplayName} invitationToken={props.invitationToken} onJoin={requestAccess} onLobby={enterLobby} />;
  }

  if (state === "ended") return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><PhoneOff className="mx-auto h-8 w-8 text-blue-300" /><h1 className="mt-3 text-2xl font-semibold">Meeting ended</h1><p className="mt-2 text-sm text-slate-300">This Quantum Reach meeting has ended.</p>{props.dashboardReturnUrl ? <Button href={props.dashboardReturnUrl} className="mt-5">Return to meeting details</Button> : null}</div></div>;
  if (state === "disconnected") return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-50"><div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><LogOut className="mx-auto h-8 w-8 text-blue-300" /><h1 className="mt-3 text-2xl font-semibold">You left the meeting</h1>{props.dashboardReturnUrl ? <Button href={props.dashboardReturnUrl} className="mt-5">Return to meeting details</Button> : null}</div></div>;

  return <LiveKitRoom
    serverUrl={access.url}
    token={access.token}
    connect
    audio={choice.microphoneEnabled ? { deviceId: choice.microphoneDeviceId || undefined } : false}
    video={choice.cameraEnabled ? { deviceId: choice.cameraDeviceId || undefined } : false}
    options={{ adaptiveStream: true, dynacast: true }}
    onConnected={() => setState("connected")}
    onError={() => { setError("The meeting room could not be connected. Check your network and try again."); setState("failed"); }}
    onMediaDeviceFailure={(_, kind) => setError(readableMediaError(undefined, kind))}
    className="min-h-screen"
  >
    <RoomExperience
      meeting={props.meeting}
      access={access}
      invitationToken={props.invitationToken}
      onExit={(ended) => setState(ended ? "ended" : "disconnected")}
      onFailure={(message) => { setError(message); setState("failed"); }}
      propsWorkspaceId={props.workspaceId}
    />
  </LiveKitRoom>;
}
