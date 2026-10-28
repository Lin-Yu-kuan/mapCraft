import type {
  LLMProvider,
  GenerateRequest,
  PingResult,
  TokenUsage,
} from './types';
import { normalizeError } from './errors';
import {
  CreateMLCEngine,
  hasModelInCache,
  type MLCEngine,
  type InitProgressReport,
} from '@mlc-ai/web-llm';

export interface WebGPUProviderOptions {
  model?: string;
  onProgress?: (report: InitProgressReport) => void;
}

// 全域共享單例 Engine，避免每次呼叫重複載入 2.3GB 模型
let cachedEngine: MLCEngine | null = null;
let currentModelId: string | null = null;
let initPromise: Promise<MLCEngine> | null = null;
const globalProgressListeners: Set<(report: InitProgressReport) => void> = new Set();

export function addWebGPUProgressListener(cb: (report: InitProgressReport) => void) {
  globalProgressListeners.add(cb);
  return () => {
    globalProgressListeners.delete(cb);
  };
}

export function isWebGPUSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return 'gpu' in navigator && Boolean((navigator as unknown as { gpu?: unknown }).gpu);
}

export async function isWebGPUModelCached(model: string): Promise<boolean> {
  if (cachedEngine && currentModelId === model) {
    return true;
  }
  return hasModelInCache(model);
}

export class WebGPUProvider implements LLMProvider {
  readonly id = 'webgpu';
  private model: string;
  private onProgress?: (report: InitProgressReport) => void;

  constructor(options: WebGPUProviderOptions = {}) {
    // 預設推薦 3B 標準版（約 2.3GB）
    this.model = options.model || 'Qwen2.5-3B-Instruct-q4f16_1-MLC';
    this.onProgress = options.onProgress;
  }

  async preload(signal?: AbortSignal): Promise<void> {
    try {
      await this.getEngine(signal);
    } catch (err: unknown) {
      throw normalizeError(err, this.id);
    }
  }

  private async getEngine(signal?: AbortSignal): Promise<MLCEngine> {
    if (!isWebGPUSupported()) {
      throw new Error(
        '您的瀏覽器或硬體環境尚未支援或未啟用 WebGPU。請使用 Chrome 113+、Edge 或 Safari 18+，並確認已開啟瀏覽器硬體加速。'
      );
    }

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // 若快取的 Engine 與當前要求的 Model 相同，直接使用
    if (cachedEngine && currentModelId === this.model) {
      return cachedEngine;
    }

    // 若有正在初始化的 Promise，等待其完成
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      try {
        if (cachedEngine) {
          try {
            await cachedEngine.unload();
          } catch {
            // ignore unload error
          }
          cachedEngine = null;
          currentModelId = null;
        }

        const handleProgress = (report: InitProgressReport) => {
          this.onProgress?.(report);
          for (const listener of globalProgressListeners) {
            listener(report);
          }
        };

        const engine = await CreateMLCEngine(this.model, {
          initProgressCallback: handleProgress,
        });

        cachedEngine = engine;
        currentModelId = this.model;
        return engine;
      } finally {
        initPromise = null;
      }
    })();

    return initPromise;
  }

  async generate(req: GenerateRequest): Promise<{ text: string; usage?: TokenUsage }> {
    try {
      const engine = await this.getEngine(req.signal);

      const messages: { role: 'system' | 'user'; content: string }[] = [];
      if (req.system) {
        messages.push({ role: 'system', content: req.system });
      }
      messages.push({ role: 'user', content: req.user });

      const completion = await engine.chat.completions.create({
        messages,
        temperature: req.temperature,
        max_tokens: req.maxOutputTokens,
        stream: false,
      });

      const choice = completion.choices[0];
      const text = choice?.message?.content || '';

      const usage: TokenUsage | undefined = completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined;

      return { text, usage };
    } catch (err: unknown) {
      throw normalizeError(err, this.id);
    }
  }

  async *stream(req: GenerateRequest): AsyncIterable<{ delta: string }> {
    try {
      const engine = await this.getEngine(req.signal);

      const messages: { role: 'system' | 'user'; content: string }[] = [];
      if (req.system) {
        messages.push({ role: 'system', content: req.system });
      }
      messages.push({ role: 'user', content: req.user });

      const asyncChunkIter = await engine.chat.completions.create({
        messages,
        temperature: req.temperature,
        max_tokens: req.maxOutputTokens,
        stream: true,
      });

      for await (const chunk of asyncChunkIter) {
        if (req.signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          yield { delta };
        }
      }
    } catch (err: unknown) {
      throw normalizeError(err, this.id);
    }
  }

  async ping(signal?: AbortSignal): Promise<PingResult> {
    const startTime = performance.now();
    try {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (!isWebGPUSupported()) {
        return {
          ok: false,
          latencyMs: Math.round(performance.now() - startTime),
          error: {
            code: 'PROVIDER_ERROR',
            providerId: this.id,
            messageForUser:
              '您的瀏覽器未支援或未開啟 WebGPU。請使用 Chrome 113+ / Edge 並開啟硬體加速。',
          },
        };
      }

      // 檢查模型是否已載入完成
      const isLoaded = Boolean(cachedEngine && currentModelId === this.model);
      return {
        ok: true,
        latencyMs: Math.round(performance.now() - startTime),
        modelEcho: isLoaded
          ? `WebGPU (${this.model}) Ready`
          : `WebGPU Supported (Model not preloaded)`,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - startTime),
        error: normalizeError(err, this.id),
      };
    }
  }
}
