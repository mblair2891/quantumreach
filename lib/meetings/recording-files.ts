import { randomUUID } from "node:crypto";
import type { MeetingProviderArtifact } from "@prisma/client";

export const MAX_UPLOAD_BYTES=BigInt(process.env.MEETING_RECORDING_MAX_UPLOAD_BYTES||"5368709120");
const UNSPECIFIED_MIME = new Set(["", "application/octet-stream"]);
const EXTENSION_RULES:Record<string,{canonical:string;aliases:string[]}>= {
  ".m4a": { canonical: "audio/mp4", aliases: ["audio/mp4", "audio/m4a", "audio/x-m4a"] },
  ".mp4": { canonical: "video/mp4", aliases: ["video/mp4"] },
  ".mp3": { canonical: "audio/mpeg", aliases: ["audio/mpeg"] },
  ".wav": { canonical: "audio/wav", aliases: ["audio/wav", "audio/x-wav"] },
  ".webm": { canonical: "video/webm", aliases: ["video/webm", "audio/webm"] },
  ".mov": { canonical: "video/quicktime", aliases: ["video/quicktime"] },
};
const UPLOAD_ERROR = "Unsupported recording file type. Upload MP4, M4A, MP3, WAV, WebM, or MOV.";

export function safeFileName(n:string){return (n.split(/[\\/]/).pop()||"recording").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(0,120)||"recording"}
function extensionFor(name:string){ const lower=safeFileName(name).trim().toLowerCase(); const dot=lower.lastIndexOf("."); return dot >= 0 ? lower.slice(dot) : ""; }
export function normalizeRecordingMime(fileName:string, suppliedMime?:string | null){
  const ext=extensionFor(fileName);
  const rule=EXTENSION_RULES[ext];
  if(!rule) throw new Error(UPLOAD_ERROR);
  const mime=String(suppliedMime||"").trim().toLowerCase();
  if(UNSPECIFIED_MIME.has(mime)) return rule.canonical;
  if(rule.aliases.includes(mime)) return ext === ".webm" ? mime : rule.canonical;
  throw new Error(UPLOAD_ERROR);
}
export function validateRecordingFile(name:string,mime:string,size:bigint){ if(size<=BigInt(0)) throw new Error("Recording file is empty."); if(size>MAX_UPLOAD_BYTES) throw new Error("Recording file is larger than the configured upload limit."); return normalizeRecordingMime(name,mime); }
export function recordingObjectKey(workspaceId:string,meetingId:string,recordingId:string,source:"local"|"zoom",fileName:string,artifactId?:string){return `workspaces/${workspaceId}/meetings/${meetingId}/recordings/${recordingId}/${source}/${artifactId?`${artifactId}/`:""}${randomUUID()}-${safeFileName(fileName)}`}
export function mimeFromZoomFileType(fileType?:string){ const f=(fileType||"").toUpperCase(); if(f==="MP4") return "video/mp4"; if(f==="M4A") return "audio/mp4"; if(f==="MP3") return "audio/mpeg"; if(f==="WAV") return "audio/wav"; if(f==="WEBM") return "video/webm"; if(f==="VTT") return "text/vtt"; if(f==="TXT") return "text/plain"; return "application/octet-stream"; }
export function isTranscriptArtifact(a:Pick<MeetingProviderArtifact,"fileType"|"recordingType"|"mimeType">){return [a.fileType,a.recordingType,a.mimeType].some(v=>String(v||"").toLowerCase().includes("transcript")||String(v||"").toLowerCase().includes("vtt"))}
