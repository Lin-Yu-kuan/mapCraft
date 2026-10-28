import { describe, it, expect } from 'vitest';
import { normalizeError } from '@/lib/llm/errors';
import type { NormalizedError } from '@/lib/llm/types';

describe('normalizeError (SPEC §5.2)', () => {
  it('converts 401 and 403 into UNAUTHORIZED and redacts keys', () => {
    const errorWithKey = new Error('Invalid key sk-secret1234567890123456');
    const result = normalizeError(errorWithKey, 'openai', 401);

    expect(result.code).toBe('UNAUTHORIZED');
    expect(result.httpStatus).toBe(401);
    expect(result.providerId).toBe('openai');
    expect(result.messageForUser).toContain('金鑰無效');
    // 嚴格確保原始錯誤訊息中的金鑰被遮罩
    expect(String(result.raw)).not.toContain('sk-secret1234567890123456');
    expect(String(result.raw)).toContain('sk-…3456');
  });

  it('converts 429 into RATE_LIMIT', () => {
    const result = normalizeError('Rate limit exceeded', 'openai', 429);
    expect(result.code).toBe('RATE_LIMIT');
    expect(result.messageForUser).toContain('已達供應商速率或額度上限');
  });

  it('converts 500+ status into PROVIDER_ERROR', () => {
    const result500 = normalizeError('Internal Server Error', 'anthropic', 500);
    expect(result500.code).toBe('PROVIDER_ERROR');
    expect(result500.messageForUser).toContain('供應商伺服器暫時異常');

    const result503 = normalizeError('Service Unavailable', 'google', 503);
    expect(result503.code).toBe('PROVIDER_ERROR');
  });

  it('handles CORS and network failures with provider-specific guidance', () => {
    const networkErr = new TypeError('Failed to fetch');

    // 一般 Provider -> 提示 CORS / Proxy
    const generalResult = normalizeError(networkErr, 'openai');
    expect(generalResult.code).toBe('CORS_OR_NETWORK');
    expect(generalResult.messageForUser).toContain('CORS 限制');

    // Ollama -> 專屬提示 OLLAMA_ORIGINS
    const ollamaResult = normalizeError(networkErr, 'ollama');
    expect(ollamaResult.code).toBe('CORS_OR_NETWORK');
    expect(ollamaResult.messageForUser).toContain('OLLAMA_ORIGINS="*"');
  });

  it('converts AbortError into TIMEOUT', () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';

    const result = normalizeError(abortErr, 'deepseek');
    expect(result.code).toBe('TIMEOUT');
    expect(result.messageForUser).toContain('請求逾時或已取消');
  });

  it('passes through existing NormalizedError while redacting its message', () => {
    const existing: NormalizedError = {
      code: 'UNAUTHORIZED',
      providerId: 'custom',
      messageForUser: 'Custom error with key sk-abcdef12345678901234',
    };

    const result = normalizeError(existing, 'custom');
    expect(result.code).toBe('UNAUTHORIZED');
    expect(result.messageForUser).not.toContain('sk-abcdef12345678901234');
    expect(result.messageForUser).toContain('sk-…1234');
  });

  it('extracts user-facing messages from nested error objects instead of stringifying as [object Object]', () => {
    const nested = {
      error: {
        messageForUser: 'WebGPU 模型下載失敗，請重試。',
      },
    };

    const result = normalizeError(nested, 'webgpu');
    expect(result.code).toBe('UNKNOWN');
    expect(result.messageForUser).toContain('WebGPU 模型下載失敗');
    expect(result.messageForUser).not.toContain('[object Object]');
  });
});
