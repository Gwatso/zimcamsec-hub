/**
 * Blob storage for PDFs, generated previews and cover images.
 *
 * `FileStorage` is the seam for swapping in S3 / Cloudflare R2 / Backblaze
 * later; the local-disk implementation is the default and is what small
 * self-hosted deployments (and development) use.
 */
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { getEnv } from "./env";

export interface ByteRange {
  start: number;
  /** Inclusive. */
  end: number;
}

export interface FileStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Streams the object (or a byte range of it) as a web ReadableStream. */
  stream(key: string, range?: ByteRange): ReadableStream<Uint8Array>;
  size(key: string): Promise<number | null>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]{0,200}$/;

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Resolves a key to a path, rejecting anything that could escape the root. */
  private path(key: string): string {
    if (!KEY_PATTERN.test(key) || key.includes("..")) {
      throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
    }
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error("Storage key escapes root");
    return full;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    // Write-then-rename so readers never observe a half-written file.
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, target);
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  stream(key: string, range?: ByteRange): ReadableStream<Uint8Array> {
    const nodeStream = createReadStream(this.path(key), range ? { start: range.start, end: range.end } : undefined);
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.path(key))).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}

let instance: FileStorage | undefined;

export function getStorage(): FileStorage {
  instance ??= new LocalFileStorage(getEnv().STORAGE_DIR);
  return instance;
}
