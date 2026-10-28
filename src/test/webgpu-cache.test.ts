import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasModelInCache } = vi.hoisted(() => ({
  hasModelInCache: vi.fn(),
}));

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn(),
  hasModelInCache,
}));

import { isWebGPUModelCached } from '@/lib/llm/webgpu';

describe('isWebGPUModelCached', () => {
  beforeEach(() => {
    hasModelInCache.mockReset();
  });

  it('checks the selected model in the WebLLM browser cache', async () => {
    hasModelInCache.mockResolvedValue(true);

    await expect(
      isWebGPUModelCached('Qwen2.5-3B-Instruct-q4f16_1-MLC')
    ).resolves.toBe(true);
    expect(hasModelInCache).toHaveBeenCalledWith(
      'Qwen2.5-3B-Instruct-q4f16_1-MLC'
    );
  });

  it('reports models that are not in the browser cache', async () => {
    hasModelInCache.mockResolvedValue(false);

    await expect(
      isWebGPUModelCached('Qwen2.5-1.5B-Instruct-q4f16_1-MLC')
    ).resolves.toBe(false);
  });
});
