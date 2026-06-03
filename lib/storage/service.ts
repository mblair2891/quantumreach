export interface StorageService { putPrivateObject(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<{ key: string; bucket: string | undefined }>; }

export class R2StorageService implements StorageService {
  async putPrivateObject(key: string, body: Buffer | Uint8Array | string, contentType?: string) {
    // Keep the payload and content type in the contract for future signed R2 uploads while this MVP abstraction remains private-only.
    void body;
    void contentType;
    if (!process.env.R2_BUCKET_NAME) throw new Error("R2_BUCKET_NAME is required before storing document assets.");
    return { key, bucket: process.env.R2_BUCKET_NAME };
  }
}
