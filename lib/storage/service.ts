export interface StorageService { putPrivateObject(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<{ key: string; bucket: string | undefined }>; }

export class R2StorageService implements StorageService {
  async putPrivateObject(key: string, _body: Buffer | Uint8Array | string, _contentType?: string) {
    // R2 remains private by default. Wire a signed S3-compatible client in deployment once credentials are available.
    if (!process.env.R2_BUCKET_NAME) throw new Error("R2_BUCKET_NAME is required before storing document assets.");
    return { key, bucket: process.env.R2_BUCKET_NAME };
  }
}
