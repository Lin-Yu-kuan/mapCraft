import { MapNodeSchema } from './schemas';
import type { LearningMap, NodeProgress, Lesson } from './types';

/**
 * 方案 B：網址直接分享（URL State Direct Share）純函式模組
 * 支援原生 Deflate 壓縮（CompressionStream）與 UTF-8 Base64URL 編解碼，零第三方依賴。
 */

export interface SharePayload {
  v: 1;
  map: LearningMap;
  progress?: NodeProgress[];
  lessons?: Lesson[];
}

export interface EncodeShareResult {
  encoded: string;
  includesLessons: boolean;
  byteLength: number;
}

/** 網址安全長度上限（超過此長度時自動省略龐大教材筆記，僅保留地圖骨架與進度） */
const MAX_URL_ENCODED_CHARS = 14000;

/** 敏感金鑰特徵掃描，防止任何金鑰進入分享網址 */
const SENSITIVE_KEY_PATTERN =
  /(?:sk-[a-zA-Z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ya29\.[A-Za-z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_.-]+)/;

/**
 * 將 Uint8Array 轉為 URL-Safe Base64 字串（無 + / =）
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 將 URL-Safe Base64 字串還原為 Uint8Array
 */
export function base64UrlToBytes(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 嘗試使用瀏覽器原生 CompressionStream('deflate-raw') 壓縮位元組
 */
async function tryCompressBytes(input: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') {
    return null;
  }
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    const writePromise = (async () => {
      await writer.write(input as unknown as BufferSource);
      await writer.close();
    })();

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLength += value.length;
      }
    }

    await writePromise;

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * 使用瀏覽器原生 DecompressionStream('deflate-raw') 解壓縮位元組
 */
async function decompressBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('當前環境不支援 DecompressionStream 解壓縮。');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  const writePromise = (async () => {
    await writer.write(compressed as unknown as BufferSource);
    await writer.close();
  })();

  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  await writePromise;

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function encodeRawObject(obj: SharePayload): Promise<string> {
  const json = JSON.stringify(obj);
  if (SENSITIVE_KEY_PATTERN.test(json)) {
    throw new Error('安全性阻斷：分享資料中偵測到疑似 API 金鑰或憑證特徵！');
  }
  const utf8Bytes = new TextEncoder().encode(json);
  const compressed = await tryCompressBytes(utf8Bytes);
  if (compressed && compressed.length < utf8Bytes.length) {
    return `z.${bytesToBase64Url(compressed)}`;
  }
  return `u.${bytesToBase64Url(utf8Bytes)}`;
}

/**
 * 將學習地圖（含選配進度與教材）編碼為可放入網址參數的短字串
 * 若包含教材後超過網址安全長度，會自動退回僅包含地圖骨架與進度。
 */
export async function encodeSharePayload(
  map: LearningMap,
  progress?: NodeProgress[],
  lessons?: Lesson[]
): Promise<EncodeShareResult> {
  const hasLessons = Boolean(lessons && lessons.length > 0);

  if (hasLessons) {
    const fullPayload: SharePayload = {
      v: 1,
      map,
      progress: progress && progress.length > 0 ? progress : undefined,
      lessons,
    };
    const encodedFull = await encodeRawObject(fullPayload);
    if (encodedFull.length <= MAX_URL_ENCODED_CHARS) {
      return {
        encoded: encodedFull,
        includesLessons: true,
        byteLength: encodedFull.length,
      };
    }
  }

  // 若無教材，或包含教材後網址過長，僅編碼地圖骨架與進度
  const compactPayload: SharePayload = {
    v: 1,
    map,
    progress: progress && progress.length > 0 ? progress : undefined,
  };
  const encodedCompact = await encodeRawObject(compactPayload);
  return {
    encoded: encodedCompact,
    includesLessons: false,
    byteLength: encodedCompact.length,
  };
}

/**
 * 解碼網址參數中的分享字串並驗證結構合法性
 */
export async function decodeSharePayload(encoded: string): Promise<SharePayload> {
  const trimmed = encoded.trim();
  if (!trimmed || trimmed.length < 3) {
    throw new Error('無效的分享資料：內容為空。');
  }

  const prefix = trimmed.slice(0, 2);
  const body = trimmed.slice(2);

  let utf8Bytes: Uint8Array;
  try {
    const rawBytes = base64UrlToBytes(body);
    if (prefix === 'z.') {
      utf8Bytes = await decompressBytes(rawBytes);
    } else if (prefix === 'u.') {
      utf8Bytes = rawBytes;
    } else {
      throw new Error('不支援的分享編碼版本。');
    }
  } catch (err) {
    throw new Error(
      `無法解碼分享網址資料：${err instanceof Error ? err.message : String(err)}`
    );
  }

  let parsed: unknown;
  try {
    const jsonStr = new TextDecoder().decode(utf8Bytes);
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('分享資料損毀：非合法的 JSON 格式。');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('分享資料格式不正確。');
  }

  const candidate = parsed as Partial<SharePayload>;
  if (
    candidate.v !== 1 ||
    !candidate.map ||
    typeof candidate.map.id !== 'string' ||
    typeof candidate.map.title !== 'string' ||
    !candidate.map.root
  ) {
    throw new Error('分享資料缺少必要的學習地圖欄位。');
  }

  // 驗證樹狀節點結構安全性
  MapNodeSchema.parse(candidate.map.root);

  return {
    v: 1,
    map: candidate.map,
    progress: Array.isArray(candidate.progress) ? candidate.progress : undefined,
    lessons: Array.isArray(candidate.lessons) ? candidate.lessons : undefined,
  };
}

/**
 * 組合 HashRouter 相容的分享連結
 */
export function buildShareUrl(
  baseUrl: string,
  params: { data?: string; gdrive?: string }
): string {
  const cleanBase = (baseUrl.split('#')[0] ?? '').replace(/\/?$/, '/');
  const searchParams = new URLSearchParams();
  if (params.data) {
    searchParams.set('data', params.data);
  }
  if (params.gdrive) {
    searchParams.set('gdrive', params.gdrive);
  }
  return `${cleanBase}#/share?${searchParams.toString()}`;
}
