import type { NormalizedError } from './types';
import { redact } from './redact';

export function normalizeError(
  err: unknown,
  providerId: string,
  httpStatus?: number
): NormalizedError {
  // 若已經是 NormalizedError 則直接回傳（確保訊息已 redact）
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'messageForUser' in err
  ) {
    const norm = err as NormalizedError;
    return {
      ...norm,
      messageForUser: redact(norm.messageForUser),
    };
  }

  let rawMessage = '';
  if (err instanceof Error) {
    rawMessage = err.message;
  } else if (typeof err === 'object' && err !== null) {
    try {
      rawMessage = JSON.stringify(err);
    } catch {
      rawMessage = String(err);
    }
  } else {
    rawMessage = String(err);
  }
  const safeMessage = redact(rawMessage);

  // 1. 逾時與使用者主動中止
  if (err instanceof Error && err.name === 'AbortError') {
    return {
      code: 'TIMEOUT',
      httpStatus,
      providerId,
      messageForUser: '請求逾時或已取消，可能是模型回應時間過長或網路不穩。',
      raw: safeMessage,
    };
  }

  // 2. HTTP 狀態碼判斷
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      code: 'UNAUTHORIZED',
      httpStatus,
      providerId,
      messageForUser: '金鑰無效、權限不足，或此模型未開通。請檢查您的 API 金鑰。',
      raw: safeMessage,
    };
  }

  if (httpStatus === 429) {
    return {
      code: 'RATE_LIMIT',
      httpStatus,
      providerId,
      messageForUser: '已達供應商速率或額度上限，請稍後重試或切換至其他模型。',
      raw: safeMessage,
    };
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      code: 'PROVIDER_ERROR',
      httpStatus,
      providerId,
      messageForUser: '供應商伺服器暫時異常，請稍後重試。',
      raw: safeMessage,
    };
  }

  // 3. 網路連線 / CORS / Ollama 本機連線失敗
  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError') ||
    rawMessage.includes('CORS') ||
    rawMessage.includes('Network request failed')
  ) {
    if (providerId === 'ollama') {
      return {
        code: 'CORS_OR_NETWORK',
        httpStatus,
        providerId,
        messageForUser:
          '找不到本機 Ollama 服務。請確認已啟動本機伺服器，並已設定環境變數 OLLAMA_ORIGINS="*"。',
        raw: safeMessage,
      };
    }

    return {
      code: 'CORS_OR_NETWORK',
      httpStatus,
      providerId,
      messageForUser:
        '瀏覽器無法直連此服務（CORS 限制）。請改用支援直連的供應商，或填入自架 Proxy Base URL。',
      raw: safeMessage,
    };
  }

  return {
    code: 'UNKNOWN',
    httpStatus,
    providerId,
    messageForUser: `發生未知錯誤（${providerId}）：${safeMessage}`,
    raw: safeMessage,
  };
}
