import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from '@/lib/llm/openaiCompatible';

describe('OpenAICompatibleProvider (Golden Path Provider)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends correct headers and body for standard OpenAI requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"title":"測試地圖"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    });
    globalThis.fetch = fetchMock;

    const provider = new OpenAICompatibleProvider({
      id: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key-1234567890123456',
      model: 'gpt-4o-mini',
    });

    const result = await provider.generate({
      system: 'You are an architect.',
      user: 'Generate map',
      temperature: 0.4,
      maxOutputTokens: 2000,
      jsonSchema: { type: 'object' },
      schemaName: 'mapSchema',
    });

    expect(result.text).toBe('{"title":"測試地圖"}');
    expect(result.usage?.totalTokens).toBe(30);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call0 = fetchMock.mock.calls[0];
    expect(call0).toBeDefined();
    const [url, options] = call0 as [string, RequestInit & { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(options.headers['Authorization']).toBe(
      'Bearer sk-test-key-1234567890123456'
    );

    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.name).toBe('mapSchema');
  });

  it('formats Azure OpenAI deployment URL and api-key header correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'azure output' } }],
      }),
    });
    globalThis.fetch = fetchMock;

    const provider = new OpenAICompatibleProvider({
      id: 'azure',
      baseUrl: 'https://my-resource.openai.azure.com',
      apiKey: 'azure-key-123',
      model: 'ignored-by-azure',
      azure: {
        deployment: 'my-gpt4o-deployment',
        apiVersion: '2024-08-01-preview',
      },
    });

    await provider.generate({
      system: 'sys',
      user: 'usr',
      temperature: 0,
      maxOutputTokens: 100,
    });

    const callAzure = fetchMock.mock.calls[0];
    expect(callAzure).toBeDefined();
    const [url, options] = callAzure as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain(
      '/openai/deployments/my-gpt4o-deployment/chat/completions?api-version=2024-08-01-preview'
    );
    expect(options.headers['api-key']).toBe('azure-key-123');
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('handles DeepSeek and Ollama schema variants', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{}' } }],
      }),
    });
    globalThis.fetch = fetchMock;

    // DeepSeek -> json_object
    const deepseek = new OpenAICompatibleProvider({
      id: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    });
    await deepseek.generate({
      system: 'sys',
      user: 'usr',
      temperature: 0,
      maxOutputTokens: 50,
      jsonSchema: { type: 'object' },
    });
    const dsCall = fetchMock.mock.calls[0];
    expect(dsCall).toBeDefined();
    const dsBody = JSON.parse((dsCall as [string, RequestInit])[1]?.body as string);
    expect(dsBody.response_format).toEqual({ type: 'json_object' });

    // Ollama -> format: schema
    const ollama = new OpenAICompatibleProvider({
      id: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5',
    });
    await ollama.generate({
      system: 'sys',
      user: 'usr',
      temperature: 0,
      maxOutputTokens: 50,
      jsonSchema: { type: 'object' },
    });
    const ollamaCall = fetchMock.mock.calls[1];
    expect(ollamaCall).toBeDefined();
    const ollamaBody = JSON.parse((ollamaCall as [string, RequestInit])[1]?.body as string);
    expect(ollamaBody.format).toEqual({ type: 'object' });
  });

  it('streams chunks from SSE response', async () => {
    const sseContent = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseContent));
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    });

    const chunks: string[] = [];
    for await (const chunk of provider.stream({
      system: 'sys',
      user: 'usr',
      temperature: 0,
      maxOutputTokens: 50,
    })) {
      chunks.push(chunk.delta);
    }

    expect(chunks.join('')).toBe('Hello World');
  });

  it('ping returns latency on success and normalized error on failure', async () => {
    // 成功測試
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
    });

    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    });

    const okResult = await provider.ping();
    expect(okResult.ok).toBe(true);
    expect(typeof okResult.latencyMs).toBe('number');
    expect(okResult.modelEcho).toBe('gpt-4o');

    // 失敗測試（401 Unauthorized）
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Incorrect API key provided' } }),
    });

    const errResult = await provider.ping();
    expect(errResult.ok).toBe(false);
    expect(errResult.error?.code).toBe('UNAUTHORIZED');
    expect(errResult.error?.messageForUser).toContain('金鑰無效');
  });
});
