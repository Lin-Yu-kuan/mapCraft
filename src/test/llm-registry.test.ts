import { describe, it, expect } from 'vitest';
import {
  getAllProviders,
  getProviderMeta,
  getDefaultModel,
  PROVIDER_REGISTRY,
} from '@/lib/llm';

describe('LLM Provider Registry (SPEC §5.2)', () => {
  const expectedProviderIds = [
    'webgpu',
    'openai',
    'azure',
    'anthropic',
    'google',
    'deepseek',
    'openrouter',
    'ollama',
    'custom',
  ];

  it('contains all 9 required providers (including WebGPU)', () => {
    const all = getAllProviders();
    expect(all.length).toBe(9);

    for (const id of expectedProviderIds) {
      expect(PROVIDER_REGISTRY[id]).toBeDefined();
      expect(getProviderMeta(id)?.id).toBe(id);
    }
  });

  it('configures defaultBaseUrl according to SPEC §5.2 matrix', () => {
    expect(PROVIDER_REGISTRY.openai?.defaultBaseUrl).toBe('https://api.openai.com/v1');
    expect(PROVIDER_REGISTRY.anthropic?.defaultBaseUrl).toBe('https://api.anthropic.com/v1');
    expect(PROVIDER_REGISTRY.google?.defaultBaseUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta'
    );
    expect(PROVIDER_REGISTRY.deepseek?.defaultBaseUrl).toBe('https://api.deepseek.com');
    expect(PROVIDER_REGISTRY.openrouter?.defaultBaseUrl).toBe('https://openrouter.ai/api/v1');
    expect(PROVIDER_REGISTRY.ollama?.defaultBaseUrl).toBe('http://localhost:11434/v1');
  });

  it('flags special provider requirements correctly', () => {
    // Anthropic 必須提示 direct browser header
    expect(PROVIDER_REGISTRY.anthropic?.requiresDirectBrowserHeader).toBe(true);
    // Ollama 必須提示本機 OLLAMA_ORIGINS 限制
    expect(PROVIDER_REGISTRY.ollama?.requiresCustomOriginsNotice).toBe(true);
  });

  it('returns appropriate default models based on role', () => {
    // OpenAI: map 偏好便宜快速 (gpt-4o-mini)，lesson 偏好旗艦品質 (gpt-4o)
    expect(getDefaultModel('openai', 'map')).toBe('gpt-4o-mini');
    expect(getDefaultModel('openai', 'lesson')).toBe('gpt-4o');

    // Anthropic: map 偏好 haiku，lesson 偏好 sonnet
    expect(getDefaultModel('anthropic', 'map')).toBe('claude-3-5-haiku-20241022');
    expect(getDefaultModel('anthropic', 'lesson')).toBe('claude-3-5-sonnet-20241022');
  });
});
