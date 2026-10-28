import type { LLMProvider } from './types';
import type { ProviderConfig } from '@/domain/types';
import { OpenAICompatibleProvider } from './openaiCompatible';
import { AnthropicProvider } from './anthropic';
import { GoogleGeminiProvider } from './google';

export function createProvider(
  config: ProviderConfig,
  apiKey?: string
): LLMProvider {
  const { id, baseUrl, model, headers, azure } = config;

  if (id === 'anthropic') {
    return new AnthropicProvider({
      baseUrl,
      apiKey,
      model,
      headers,
    });
  }

  if (id === 'google') {
    return new GoogleGeminiProvider({
      baseUrl,
      apiKey,
      model,
      headers,
    });
  }

  // 包含 openai, azure, deepseek, openrouter, ollama, custom
  return new OpenAICompatibleProvider({
    id,
    baseUrl,
    apiKey,
    model,
    headers,
    azure,
  });
}
