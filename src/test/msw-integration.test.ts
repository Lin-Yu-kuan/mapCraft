// @vitest-environment node
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw/server';
import {
  OpenAICompatibleProvider,
  AnthropicProvider,
  GoogleGeminiProvider,
} from '@/lib/llm';
import type { NormalizedError } from '@/lib/llm/types';

describe('MSW Provider Interception & Scenarios (T1.6)', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('handles standard successful map generation via MSW', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });

    const res = await provider.generate({
      system: 'sys',
      user: 'topic',
      temperature: 0.4,
      maxOutputTokens: 2000,
    });

    expect(res.text).toContain('Spring Boot 核心概念');
    expect(res.usage?.totalTokens).toBe(500);
  });

  it('handles 401 Unauthorized scenario and normalizes error with redaction', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      headers: { 'x-mock-scenario': '401' },
    });

    try {
      await provider.generate({
        system: 'sys',
        user: 'topic',
        temperature: 0,
        maxOutputTokens: 100,
      });
      expect.unreachable('Should have thrown on 401');
    } catch (err) {
      const norm = err as NormalizedError;
      expect(norm.code).toBe('UNAUTHORIZED');
      expect(norm.httpStatus).toBe(401);
      expect(norm.messageForUser).toContain('金鑰無效');
      // 確保金鑰被遮蔽
      expect(JSON.stringify(norm.raw)).not.toContain('sk-invalid1234567890123456');
      expect(JSON.stringify(norm.raw)).toContain('sk-…3456');
    }
  });

  it('handles 429 Rate Limit scenario', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      headers: { 'x-mock-scenario': '429' },
    });

    await expect(
      provider.generate({
        system: 'sys',
        user: 'topic',
        temperature: 0,
        maxOutputTokens: 100,
      })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      httpStatus: 429,
    });
  });

  it('handles 500 Provider Server Error scenario', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      headers: { 'x-mock-scenario': '500' },
    });

    await expect(
      provider.generate({
        system: 'sys',
        user: 'topic',
        temperature: 0,
        maxOutputTokens: 100,
      })
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      httpStatus: 500,
    });
  });

  it('receives raw broken JSON text on bad-json scenario for repair handling', async () => {
    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      headers: { 'x-mock-scenario': 'bad-json' },
    });

    const res = await provider.generate({
      system: 'sys',
      user: 'topic',
      temperature: 0,
      maxOutputTokens: 100,
    });

    expect(res.text).toContain('破損未閉合地圖');
  });

  it('handles Anthropic tool_use mock response', async () => {
    const provider = new AnthropicProvider({
      model: 'claude-3-5-sonnet-20241022',
    });

    const res = await provider.generate({
      system: 'sys',
      user: 'topic',
      temperature: 0,
      maxOutputTokens: 1000,
    });

    expect(res.text).toContain('依賴注入（Dependency Injection');
    expect(res.usage?.totalTokens).toBe(600);
  });

  it('handles Gemini generateContent mock response', async () => {
    const provider = new GoogleGeminiProvider({
      model: 'gemini-2.0-flash',
    });

    const res = await provider.generate({
      system: 'sys',
      user: 'topic',
      temperature: 0,
      maxOutputTokens: 1000,
    });

    expect(res.text).toContain('Spring Boot 核心概念');
    expect(res.usage?.totalTokens).toBe(500);
  });
});
