import type { ProviderMeta } from './types';

export const PROVIDER_REGISTRY: Record<string, ProviderMeta> = {
  webgpu: {
    id: 'webgpu',
    name: 'WebGPU 本機端模型（免金鑰・離線運行）',
    defaultBaseUrl: 'webgpu://local',
    isDirectBrowserSupported: true,
    supportsJsonSchema: false,
    docUrl: 'https://webllm.mlc.ai/',
    recommendedModels: [
      {
        id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        name: 'Qwen 2.5 3B（預設推薦・約 2.3GB・繁中品質高）',
        role: 'both',
        description: '標準版，中文理解與架構拆解品質優異',
      },
      {
        id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
        name: 'Qwen 2.5 1.5B（輕量版・約 1.1GB・下載迅速）',
        role: 'both',
        description: '輕量版，初次體驗下載快、硬體要求低',
      },
      {
        id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        name: 'Llama 3.2 3B（約 2.2GB・英文與邏輯表現佳）',
        role: 'both',
        description: 'Meta 輕量端側模型',
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    isDirectBrowserSupported: true,
    supportsJsonSchema: true,
    docUrl: 'https://platform.openai.com/api-keys',
    recommendedModels: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini（速度快、成本低）',
        role: 'map',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o（旗艦級理解與教材品質）',
        role: 'lesson',
      },
    ],
  },
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    defaultBaseUrl: 'https://{resource}.openai.azure.com',
    isDirectBrowserSupported: true,
    supportsJsonSchema: true,
    docUrl: 'https://portal.azure.com',
    recommendedModels: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini Deployment',
        role: 'map',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o Deployment',
        role: 'lesson',
      },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    isDirectBrowserSupported: true,
    requiresDirectBrowserHeader: true,
    supportsJsonSchema: true,
    docUrl: 'https://console.anthropic.com/settings/keys',
    recommendedModels: [
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku（極速地圖規劃）',
        role: 'map',
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet（教學結構頂級）',
        role: 'lesson',
      },
    ],
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    isDirectBrowserSupported: true,
    supportsJsonSchema: true,
    docUrl: 'https://aistudio.google.com/app/apikey',
    recommendedModels: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash（高性價比、速度極快）',
        role: 'both',
      },
      {
        id: 'gemini-2.0-pro-exp',
        name: 'Gemini 2.0 Pro（深度解析與概念推演）',
        role: 'lesson',
      },
    ],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    isDirectBrowserSupported: true,
    supportsJsonSchema: false,
    docUrl: 'https://platform.deepseek.com/api_keys',
    recommendedModels: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek-V3（高智慧、超低定價）',
        role: 'both',
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek-R1（推理強化模型）',
        role: 'lesson',
      },
    ],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    isDirectBrowserSupported: true,
    supportsJsonSchema: true,
    docUrl: 'https://openrouter.ai/keys',
    recommendedModels: [
      {
        id: 'google/gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash (via OpenRouter)',
        role: 'map',
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet (via OpenRouter)',
        role: 'lesson',
      },
    ],
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama（本機運行）',
    defaultBaseUrl: 'http://localhost:11434/v1',
    isDirectBrowserSupported: true,
    requiresCustomOriginsNotice: true,
    supportsJsonSchema: true,
    docUrl: 'https://ollama.com',
    recommendedModels: [
      {
        id: 'qwen2.5:7b',
        name: 'Qwen 2.5 7B（中文繁體表現優異）',
        role: 'both',
      },
      {
        id: 'llama3.2:3b',
        name: 'Llama 3.2 3B（輕量級本地推理）',
        role: 'both',
      },
      {
        id: 'deepseek-r1:8b',
        name: 'DeepSeek-R1 8B（本地推理模型）',
        role: 'lesson',
      },
    ],
  },
  custom: {
    id: 'custom',
    name: '自訂（OpenAI 相容）',
    defaultBaseUrl: 'http://localhost:8000/v1',
    isDirectBrowserSupported: true,
    supportsJsonSchema: false,
    recommendedModels: [
      {
        id: 'default',
        name: '預設自訂模型',
        role: 'both',
      },
    ],
  },
};

/** 取得所有註冊的供應商清單 */
export function getAllProviders(): ProviderMeta[] {
  return Object.values(PROVIDER_REGISTRY);
}

/** 依 ID 取得特定供應商元資訊 */
export function getProviderMeta(providerId: string): ProviderMeta | undefined {
  return PROVIDER_REGISTRY[providerId];
}

/** 取得特定供應商的預設模型 */
export function getDefaultModel(
  providerId: string,
  role: 'map' | 'lesson' = 'map'
): string {
  const meta = getProviderMeta(providerId);
  if (!meta || meta.recommendedModels.length === 0) {
    return 'default';
  }

  // 優先匹配指定角色的推薦模型
  const matched = meta.recommendedModels.find(
    (m) => m.role === role || m.role === 'both'
  );
  if (matched) {
    return matched.id;
  }

  const fallback = meta.recommendedModels[0];
  return fallback ? fallback.id : 'default';
}
