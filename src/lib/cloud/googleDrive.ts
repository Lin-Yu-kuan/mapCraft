import { redact } from '../llm/redact';
import {
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
} from '../storage/settings';
import { settingsRepo } from '../db/repos/settings';
import { createBackupData } from '../storage/backup';
import { buildShareUrl } from '@/domain/share';

/**
 * 方案 A：Google Drive REST API v3 純前端整合模組
 * 採用最小權限原則（drive.file），僅存取 MapCraft 自身建立之資料夾與學習地圖檔案。
 */

export const GDRIVE_PROVIDER_ID = 'gdrive';
export const GDRIVE_FOLDER_NAME = 'MapCraft';
export const GDRIVE_SYNC_FILENAME = 'mapcraft_cloud_sync.mapcraft.json';
const GDRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GDRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface GoogleDriveUser {
  displayName: string;
  emailAddress?: string;
}

export function getGoogleDriveToken(): string {
  return getStoredApiKey(GDRIVE_PROVIDER_ID);
}

export function setGoogleDriveToken(token: string): void {
  setStoredApiKey(GDRIVE_PROVIDER_ID, token.trim());
}

export function clearGoogleDriveToken(): void {
  clearStoredApiKey(GDRIVE_PROVIDER_ID);
}

/**
 * 持久化儲存已登入的 Google 帳號資訊（姓名、Email、Token 過期時間戳）
 */
export async function persistGoogleDriveUserSession(
  user: GoogleDriveUser,
  expiresInSec: number = 3600
): Promise<void> {
  const expiresAt = Date.now() + Math.max(60, expiresInSec) * 1000;
  await settingsRepo.saveSettings({
    gdriveUserEmail: user.emailAddress || '',
    gdriveUserName: user.displayName || '',
    gdriveTokenExpiresAt: expiresAt,
  });
}

/**
 * 徹底登出 Google 帳號並清除所有登入資訊
 */
export async function clearGoogleDriveUserSession(): Promise<void> {
  clearGoogleDriveToken();
  await settingsRepo.saveSettings({
    gdriveUserEmail: undefined,
    gdriveUserName: undefined,
    gdriveTokenExpiresAt: undefined,
    gdriveAutoSync: false,
    gdriveSyncFileId: undefined,
  });
}

/**
 * 檢查 Token 是否已經過期（預留 60 秒緩衝）
 */
export function isGoogleDriveTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - 60000;
}

/**
 * 若當前視窗為 Google OAuth 2.0 Implicit Flow 彈窗回呼（URL hash 含 access_token），
 * 自動將 token 傳回母視窗並關閉彈窗。
 */
export function captureOAuthRedirectTokenIfPresent(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token=')) return false;

  const queryPart = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(queryPart);
  const accessToken = params.get('access_token');
  const expiresInStr = params.get('expires_in');
  const expiresInSec = expiresInStr ? parseInt(expiresInStr, 10) : 3600;
  const state = params.get('state');

  if (accessToken && state === 'mapcraft_gdrive_oauth') {
    setGoogleDriveToken(accessToken);
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: 'MAPCRAFT_GDRIVE_OAUTH_SUCCESS',
            accessToken,
            expiresIn: expiresInSec,
          },
          window.location.origin
        );
        window.close();
      }
    } catch {
      // ignore cross-window errors
    }
    // 清除網址列中的敏感 token
    window.history.replaceState(null, '', window.location.pathname + '#/');
    return true;
  }
  return false;
}

export const DEFAULT_GOOGLE_CLIENT_ID =
  '511004837788-4eds2v5ca2pktmtsvrcoi8cr165e6ct0.apps.googleusercontent.com';

/**
 * 啟動 Google OAuth 2.0 授權彈窗取得 Google Drive (drive.file) Access Token
 * @param clientId 自訂 Google Client ID（選填，若無則使用預設值）
 * @param loginHint 記住的上一個帳號 email，用於一鍵快速續期（免重複手動選帳號）
 */
export function requestGoogleDriveOAuthToken(
  clientId?: string,
  loginHint?: string
): Promise<{ token: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('瀏覽器環境不可用'));
      return;
    }

    const trimmedClientId = (
      clientId ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
      DEFAULT_GOOGLE_CLIENT_ID
    ).trim();

    if (!trimmedClientId) {
      reject(
        new Error(
          '尚未配置 Google Client ID。請於下方「進階自訂設定」填入 Google OAuth Client ID，即可一鍵登入授權。'
        )
      );
      return;
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', trimmedClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', 'mapcraft_gdrive_oauth');

    if (loginHint && loginHint.trim()) {
      authUrl.searchParams.set('login_hint', loginHint.trim());
    } else {
      authUrl.searchParams.set('prompt', 'select_account');
    }

    const width = 520;
    const height = 640;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    const popup = window.open(
      authUrl.toString(),
      'mapcraft_gdrive_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('彈出視窗遭瀏覽器攔截，請允許此網站開啟彈跳視窗。'));
      return;
    }

    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(checkClosedTimer);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.type === 'MAPCRAFT_GDRIVE_OAUTH_SUCCESS' &&
        typeof event.data.accessToken === 'string'
      ) {
        settled = true;
        cleanup();
        const token = event.data.accessToken as string;
        const expiresIn = typeof event.data.expiresIn === 'number' ? event.data.expiresIn : 3600;
        setGoogleDriveToken(token);
        resolve({ token, expiresIn });
      }
    };

    window.addEventListener('message', handleMessage);

    const checkClosedTimer = setInterval(() => {
      try {
        if (popup.closed && !settled) {
          settled = true;
          cleanup();
          const saved = getGoogleDriveToken();
          if (saved) {
            resolve({ token: saved, expiresIn: 3600 });
          } else {
            reject(new Error('Google 授權視窗已關閉，未完成連結。'));
          }
        }
      } catch {
        // Cross-origin frame access ignored while on accounts.google.com
      }
    }, 600);
  });
}

/**
 * 內部統一呼叫 Google Drive API 並處理錯誤遮罩
 */
async function driveFetch(
  url: string,
  options: Omit<RequestInit, 'headers'> & {
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<Response> {
  const { token, headers, ...rest } = options;
  const reqHeaders: Record<string, string> = {
    ...(headers || {}),
  };
  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: reqHeaders,
    });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`無法連線至 Google Drive：${redact(rawMsg)}`);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Google Drive 授權已過期或權限不足（HTTP ' +
          res.status +
          '），請至設定頁面重新連結 Google 帳號。'
      );
    }
    if (res.status === 404) {
      throw new Error('找不到指定的 Google Drive 雲端檔案（HTTP 404）。');
    }
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || '';
    } catch {
      // ignore
    }
    throw new Error(
      redact(`Google Drive API 錯誤 (HTTP ${res.status})${detail ? `：${detail}` : ''}`)
    );
  }

  return res;
}

/**
 * 驗證 Google Drive Token 是否有效並回傳使用者資訊
 */
export async function verifyGoogleDriveToken(
  token: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; user?: GoogleDriveUser; errorMsg?: string }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, errorMsg: '尚未提供 Google Drive Access Token' };
  }

  try {
    const res = await driveFetch(
      `${GDRIVE_API_BASE}/about?fields=user(displayName,emailAddress)`,
      {
        method: 'GET',
        token: trimmed,
        signal,
      }
    );
    const data = (await res.json()) as { user?: GoogleDriveUser };
    return {
      ok: true,
      user: data.user || { displayName: 'Google Drive User' },
    };
  } catch (err) {
    return {
      ok: false,
      errorMsg: err instanceof Error ? err.message : redact(String(err)),
    };
  }
}

/**
 * 確保使用者 Google Drive 中存在 `MapCraft` 專屬資料夾，回傳其 Folder ID
 */
export async function ensureMapCraftFolder(
  token: string,
  cachedFolderId?: string,
  signal?: AbortSignal
): Promise<string> {
  // 1. 若有快取的 folderId，先確認是否仍有效且未被移至垃圾桶
  if (cachedFolderId) {
    try {
      const checkRes = await driveFetch(
        `${GDRIVE_API_BASE}/files/${encodeURIComponent(cachedFolderId)}?fields=id,trashed`,
        { method: 'GET', token, signal }
      );
      const meta = (await checkRes.json()) as { id?: string; trashed?: boolean };
      if (meta.id && !meta.trashed) {
        return meta.id;
      }
    } catch {
      // 若已被刪除則重新搜尋或建立
    }
  }

  // 2. 搜尋名為 MapCraft 的資料夾
  const q = `mimeType='application/vnd.google-apps.folder' and name='${GDRIVE_FOLDER_NAME}' and trashed=false`;
  const listRes = await driveFetch(
    `${GDRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { method: 'GET', token, signal }
  );
  const listData = (await listRes.json()) as { files?: Array<{ id: string }> };
  const firstFolder = listData.files?.[0];
  if (firstFolder) {
    return firstFolder.id;
  }

  // 3. 建立新的 MapCraft 資料夾
  const createRes = await driveFetch(`${GDRIVE_API_BASE}/files?fields=id`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: GDRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
    signal,
  });
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

/**
 * 在 MapCraft 資料夾內尋找雲端同步主檔案 ID
 */
export async function findDriveSyncFile(
  token: string,
  folderId: string,
  cachedFileId?: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (cachedFileId) {
    try {
      const checkRes = await driveFetch(
        `${GDRIVE_API_BASE}/files/${encodeURIComponent(cachedFileId)}?fields=id,trashed`,
        { method: 'GET', token, signal }
      );
      const meta = (await checkRes.json()) as { id?: string; trashed?: boolean };
      if (meta.id && !meta.trashed) {
        return meta.id;
      }
    } catch {
      // ignore and search
    }
  }

  const q = `'${folderId}' in parents and name='${GDRIVE_SYNC_FILENAME}' and trashed=false`;
  const listRes = await driveFetch(
    `${GDRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=1`,
    { method: 'GET', token, signal }
  );
  const listData = (await listRes.json()) as { files?: Array<{ id: string }> };
  const firstFolder = listData.files?.[0];
  if (firstFolder) {
    return firstFolder.id;
  }
  return null;
}

/**
 * 從 Google Drive 下載 JSON 檔案內容
 */
export async function downloadDriveJsonFile(
  fileId: string,
  token?: string,
  signal?: AbortSignal
): Promise<string> {
  const activeToken = token || getGoogleDriveToken();
  const url = `${GDRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await driveFetch(url, {
    method: 'GET',
    token: activeToken || undefined,
    signal,
  });
  return res.text();
}

/**
 * 使用 Multipart 上傳或更新 Google Drive 上的 JSON 檔案
 */
export async function uploadDriveJsonFile(params: {
  token: string;
  folderId: string;
  existingFileId?: string | null;
  fileName: string;
  jsonContent: string;
  signal?: AbortSignal;
}): Promise<{ fileId: string }> {
  const { token, folderId, existingFileId, fileName, jsonContent, signal } = params;
  const boundary = '-------MapCraftDriveBoundary7MA4YWxkTrZu0gW';

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: 'application/json',
  };
  if (!existingFileId) {
    metadata.parents = [folderId];
  }

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const url = existingFileId
    ? `${GDRIVE_UPLOAD_BASE}/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id`
    : `${GDRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`;

  const method = existingFileId ? 'PATCH' : 'POST';

  const res = await driveFetch(url, {
    method,
    token,
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
    signal,
  });

  const data = (await res.json()) as { id: string };
  return { fileId: data.id };
}

/**
 * 將單張學習地圖（含全部節點深度筆記與進度）上傳至使用者 Google Drive 並設為公開唯讀分享
 */
export async function publishMapToGoogleDrive(
  mapId: string,
  token?: string,
  signal?: AbortSignal
): Promise<{
  fileId: string;
  shareUrl: string;
  driveWebUrl: string;
}> {
  const activeToken = (token || getGoogleDriveToken()).trim();
  if (!activeToken) {
    throw new Error('請先至「設定」頁面連結 Google Drive 帳號，才能使用雲端分享。');
  }

  const backup = await createBackupData(mapId);
  const jsonContent = JSON.stringify(backup, null, 2);
  const folderId = await ensureMapCraftFolder(activeToken, undefined, signal);
  const shareFileName = `mapcraft_shared_${mapId}.mapcraft.json`;

  // 檢查是否已有同 mapId 的分享檔，若有則直接更新同一個 fileId（保持分享連結不變）
  const q = `'${folderId}' in parents and name='${shareFileName}' and trashed=false`;
  const searchRes = await driveFetch(
    `${GDRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
    { method: 'GET', token: activeToken, signal }
  );
  const searchData = (await searchRes.json()) as { files?: Array<{ id: string }> };
  const existingFileId = searchData.files?.[0]?.id || null;

  const { fileId } = await uploadDriveJsonFile({
    token: activeToken,
    folderId,
    existingFileId,
    fileName: shareFileName,
    jsonContent,
    signal,
  });

  // 設定「知道連結的任何人皆可檢視（reader）」權限
  try {
    await driveFetch(
      `${GDRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions`,
      {
        method: 'POST',
        token: activeToken,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
        signal,
      }
    );
  } catch {
    // 若使用者屬企業 Workspace 限制公開權限，仍回傳檔案連結供同網域存取
  }

  const baseHref =
    typeof window !== 'undefined' ? window.location.href : 'https://lin-yu-kuan.github.io/mapCraft/';
  const shareUrl = buildShareUrl(baseHref, { gdrive: fileId });
  const driveWebUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

  return {
    fileId,
    shareUrl,
    driveWebUrl,
  };
}
