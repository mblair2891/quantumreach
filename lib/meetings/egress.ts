import "server-only";
import { createHmac } from "node:crypto";
import type { MeetingRecordingStatus } from "@prisma/client";

export type EgressStartResult = { egressId: string; storageKey: string; bucketName: string; fileName: string; mimeType: string };

const CONFIG_ERROR = "LiveKit recording configuration is unavailable.";

function required(name: string) { const value = process.env[name]?.trim(); if (!value) throw new Error(CONFIG_ERROR); return value; }
function b64(value: unknown) { return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url"); }
function livekitJwt() { const key = required("LIVEKIT_API_KEY"); const secret = required("LIVEKIT_API_SECRET"); const now = Math.floor(Date.now()/1000); const unsigned = `${b64({alg:"HS256",typ:"JWT"})}.${b64({iss:key,nbf:now-5,exp:now+300,video:{roomAdmin:true}})}`; return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`; }
export function getMeetingRecordingBucket() { return required("MEETING_RECORDINGS_R2_BUCKET"); }
export function buildMeetingRecordingKey(workspaceId: string, meetingId: string, recordingId: string) { return `workspaces/${encodeURIComponent(workspaceId)}/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/recording.mp4`; }
function lkUrl(path: string) { return `${required("LIVEKIT_URL").replace(/\/$/, "")}${path}`; }
function s3Config() { return { accessKey: required("MEETING_RECORDINGS_R2_ACCESS_KEY_ID"), secret: required("MEETING_RECORDINGS_R2_SECRET_ACCESS_KEY"), region: process.env.MEETING_RECORDINGS_R2_REGION || "auto", endpoint: required("MEETING_RECORDINGS_R2_ENDPOINT"), bucket: getMeetingRecordingBucket(), forcePathStyle: true }; }
export function sanitizeProviderError(error: unknown) { const message = error instanceof Error ? error.message : String(error); if (/key|secret|token|authorization|credential/i.test(message)) return "Recording provider request failed."; return message.slice(0, 240) || "Recording provider request failed."; }
async function livekitRpc(method: "StartRoomCompositeEgress"|"StopEgress"|"ListEgress", body: Record<string, unknown>) { const response = await fetch(lkUrl(`/twirp/livekit.Egress/${method}`), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${livekitJwt()}` }, body: JSON.stringify(body) }); if (!response.ok) throw new Error(`LiveKit Egress ${method} failed with status ${response.status}.`); return response.json() as Promise<Record<string, unknown>>; }
export async function startRoomCompositeRecording(input: { workspaceId: string; meetingId: string; recordingId: string; roomName: string }): Promise<EgressStartResult> { const storageKey = buildMeetingRecordingKey(input.workspaceId, input.meetingId, input.recordingId); const fileName = "recording.mp4"; const result = await livekitRpc("StartRoomCompositeEgress", { roomName: input.roomName, layout: "speaker", fileOutputs: [{ filepath: storageKey, s3: s3Config() }] }); const egressId = String(result.egressId || result.egress_id || ""); if (!egressId) throw new Error("LiveKit did not return an Egress ID."); return { egressId, storageKey, bucketName: getMeetingRecordingBucket(), fileName, mimeType: "video/mp4" }; }
export async function stopRoomCompositeRecording(providerEgressId: string) { await livekitRpc("StopEgress", { egressId: providerEgressId }); }
export async function queryRoomCompositeRecording(providerEgressId: string) { return livekitRpc("ListEgress", { egressId: providerEgressId }); }
export function mapLiveKitStatus(status?: string): MeetingRecordingStatus { const value = String(status || "").toUpperCase(); if (value.includes("ACTIVE")) return "RECORDING"; if (value.includes("ENDING")) return "PROCESSING"; if (value.includes("COMPLETE")) return "AVAILABLE"; if (value.includes("FAILED") || value.includes("ABORT")) return "FAILED"; return "PROCESSING"; }
