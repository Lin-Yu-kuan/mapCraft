import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '@/lib/llm/anthropic';
import { GoogleGeminiProvider } from '@/lib/llm/google';

describe('AnthropicProvider & GoogleGeminiProvider (SPEC §5.2)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('AnthropicProvider', () => {
    it('sends mandatory browser direct header and parses tool_use response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'tool_use',
              name: 'mapSchema',
              input: { title: 'Anthropic Map' },
            },
          ],
          usage: { input_tokens: 50, output_tokens: 150 },
        }),
      });
      globalThis.fetch = fetchMock;

      const provider = new AnthropicProvider({
        apiKey: 'sk-ant-test-key-1234567890',
        model: 'claude-3-5-haiku-20241022',
      });

      const res = await provider.generate({
        system: 'You are Claude.',
        user: 'Generate syllabus',
        temperature: 0.2,
        maxOutputTokens: 1000,
        jsonSchema: { type: 'object' },
        schemaName: 'mapSchema',
      });

      expect(res.text).toBe('{"title":"Anthropic Map"}');
      expect(res.usage?.totalTokens).toBe(200);

      const call0 = fetchMock.mock.calls[0];
      expect(call0).toBeDefined();
      const [url, options] = call0 as [
        string,
        RequestInit & { headers: Record<string, string>; body: string },
      ];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.headers['anthropic-dangerous-direct-browser-access']).toBe(
        'true'
      );
      expect(options.headers['x-api-key']).toBe('sk-ant-test-key-1234567890');

      const body = JSON.parse(options.body);
      expect(body.tools[0].name).toBe('mapSchema');
      expect(body.tool_choice).toEqual({ type: 'tool', name: 'mapSchema' });
    });

    it('streams chunks from Anthropic SSE content_block_delta', async () => {
      const sseContent = [
        'data: {"type":"message_start"}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" Learning"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
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

      const provider = new AnthropicProvider({
        model: 'claude-3-5-sonnet-20241022',
      });

      const chunks: string[] = [];
      for await (const chunk of provider.stream({
        system: 'sys',
        user: 'usr',
        temperature: 0,
        maxOutputTokens: 100,
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks.join('')).toBe('Claude Learning');
    });
  });

  describe('GoogleGeminiProvider', () => {
    it('sends x-goog-api-key and configures responseSchema', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"title":"Gemini Map"}' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 35,
            totalTokenCount: 50,
          },
        }),
      });
      globalThis.fetch = fetchMock;

      const provider = new GoogleGeminiProvider({
        apiKey: 'AIzaSyTestGeminiKey1234567890',
        model: 'gemini-2.0-flash',
      });

      const res = await provider.generate({
        system: 'You are Gemini.',
        user: 'Make roadmap',
        temperature: 0.3,
        maxOutputTokens: 2048,
        jsonSchema: { type: 'object' },
      });

      expect(res.text).toBe('{"title":"Gemini Map"}');
      expect(res.usage?.totalTokens).toBe(50);

      const call0 = fetchMock.mock.calls[0];
      expect(call0).toBeDefined();
      const [url, options] = call0 as [
        string,
        RequestInit & { headers: Record<string, string>; body: string },
      ];

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
      );
      expect(options.headers['x-goog-api-key']).toBe(
        'AIzaSyTestGeminiKey1234567890'
      );

      const body = JSON.parse(options.body);
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.responseSchema).toEqual({ type: 'object' });
    });

    it('streams chunks from Gemini streamGenerateContent SSE', async () => {
      const sseContent = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Gemini"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" Flash"}]}}]}\n\n',
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

      const provider = new GoogleGeminiProvider({
        model: 'gemini-2.0-flash',
      });

      const chunks: string[] = [];
      for await (const chunk of provider.stream({
        system: 'sys',
        user: 'usr',
        temperature: 0,
        maxOutputTokens: 100,
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks.join('')).toBe('Gemini Flash');
    });

    it('fetches and filters models via listModels', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-3.8-flash',
              supportedGenerationMethods: ['generateContent', 'countTokens'],
            },
            {
              name: 'models/gemini-embedding-001',
              supportedGenerationMethods: ['embedContent'],
            },
            {
              name: 'models/gemini-3.8-pro',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

      const provider = new GoogleGeminiProvider({
        apiKey: 'AIzaSyTestKey123',
        model: 'gemini-3.8-flash',
      });

      const models = await provider.listModels();
      expect(models).toEqual(['gemini-3.8-flash', 'gemini-3.8-pro']);
    });
  });
});
