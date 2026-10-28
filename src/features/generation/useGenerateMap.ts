import { useState, useRef, useCallback } from 'react';
import { settingsRepo } from '@/lib/db/repos/settings';
import { mapsRepo } from '@/lib/db/repos/maps';
import { progressRepo } from '@/lib/db/repos/progress';
import { getStoredApiKey } from '@/lib/storage/settings';
import { createProvider } from '@/lib/llm/factory';
import { getProviderMeta } from '@/lib/llm/registry';
import { parseAndValidateJson } from '@/lib/llm/json';
import { normalizeError } from '@/lib/llm/errors';
import type { NormalizedError } from '@/lib/llm/types';
import {
  MapGenerationResponseSchema,
  type GenerationOptions,
  type LearningMap,
  type MapGenerationResponse,
  type NodeProgress,
} from '@/domain';
import {
  buildMapRequest,
  buildRepairRequest,
  MAP_GENERATION_JSON_SCHEMA,
} from '@/domain/prompts';
import { createMapFromResponse, flattenTree } from '@/domain/tree';

export interface UseGenerateMapResult {
  isGenerating: boolean;
  error: NormalizedError | null;
  rawOutput: string | null;
  generateMap: (topic: string, options: GenerationOptions) => Promise<LearningMap | null>;
  cancel: () => void;
  retry: () => Promise<LearningMap | null>;
  retryWithRelaxed: () => Promise<LearningMap | null>;
  clearError: () => void;
}

export function useGenerateMap(): UseGenerateMapResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef<{ topic: string; options: GenerationOptions } | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setRawOutput(null);
  }, []);

  const generateMap = useCallback(
    async (topic: string, options: GenerationOptions): Promise<LearningMap | null> => {
      clearError();
      setIsGenerating(true);
      lastParamsRef.current = { topic, options };

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const appSettings = await settingsRepo.getSettings();
        const providerId = appSettings.lastProviderId || 'openai';
        const meta = getProviderMeta(providerId);

        const apiKey = getStoredApiKey(providerId);
        if (!apiKey && providerId !== 'ollama' && providerId !== 'webgpu') {
          const err: NormalizedError = {
            code: 'UNAUTHORIZED',
            providerId,
            messageForUser: '尚未填寫 API 金鑰，請先至設定頁面完成設定。',
          };
          setError(err);
          setIsGenerating(false);
          return null;
        }

        const defaultModel =
          meta?.recommendedModels.find((m) => m.role === 'map' || m.role === 'both')?.id ||
          'gpt-4o-mini';
        const modelToUse = appSettings.lastMapModelId || defaultModel;

        const provider = createProvider(
          {
            id: providerId,
            baseUrl: meta?.defaultBaseUrl || 'https://api.openai.com/v1',
            model: modelToUse,
          },
          apiKey
        );

        // 1. 初次請求
        const req = buildMapRequest(topic, options, controller.signal);
        let rawResponse = '';
        try {
          const genRes = await provider.generate(req);
          rawResponse = genRes.text;
          setRawOutput(rawResponse);
        } catch (fetchErr: unknown) {
          if (controller.signal.aborted) {
            setIsGenerating(false);
            return null;
          }
          const normErr = normalizeError(fetchErr, providerId);
          setError(normErr);
          setIsGenerating(false);
          return null;
        }

        // 2. 解析與驗證
        let validatedData: MapGenerationResponse | null = null;
        try {
          validatedData = parseAndValidateJson<MapGenerationResponse>(
            rawResponse,
            MapGenerationResponseSchema
          );
        } catch (parseErr: unknown) {
          // SPEC §5.6 / AC-02：初次解析失敗，執行 1 次自動修復重試
          const firstErrMessage =
            parseErr instanceof Error ? parseErr.message : String(parseErr);

          try {
            const repairReq = buildRepairRequest(
              rawResponse,
              firstErrMessage,
              MAP_GENERATION_JSON_SCHEMA,
              controller.signal
            );
            const repairedRes = await provider.generate(repairReq);
            const repairedRaw = repairedRes.text;
            setRawOutput(repairedRaw);

            validatedData = parseAndValidateJson<MapGenerationResponse>(
              repairedRaw,
              MapGenerationResponseSchema
            );
          } catch (repairErr: unknown) {
            if (controller.signal.aborted) {
              setIsGenerating(false);
              return null;
            }
            const normErr: NormalizedError = {
              code: 'PARSE_ERROR',
              providerId,
              messageForUser:
                '模型回傳的學習地圖結構不符合格式，已自動嘗試修復仍無法解析。您可以點擊「重試」或「放寬參數重試」。',
              raw: repairErr instanceof Error ? repairErr.message : String(repairErr),
            };
            setError(normErr);
            setIsGenerating(false);
            return null;
          }
        }

        // 3. 後處理：合成根節點、重新分配 ID、裁切限制
        const learningMap = createMapFromResponse(
          topic,
          validatedData,
          options,
          providerId,
          modelToUse
        );

        // 4. 存入 Dexie 資料庫
        await mapsRepo.save(learningMap);

        // 5. 初始化各學習節點的進度狀態為 'todo'
        const learningNodes = flattenTree(learningMap.root, false);
        const initialProgress: NodeProgress[] = learningNodes.map((node) => ({
          mapId: learningMap.id,
          nodeId: node.id,
          status: 'todo',
          attempts: 0,
          correct: 0,
          updatedAt: Date.now(),
        }));

        if (initialProgress.length > 0) {
          await progressRepo.batchSave(initialProgress);
        }

        setIsGenerating(false);
        return learningMap;
      } catch (unknownErr: unknown) {
        if (controller.signal.aborted) {
          setIsGenerating(false);
          return null;
        }
        const normErr = normalizeError(unknownErr, 'unknown');
        setError(normErr);
        setIsGenerating(false);
        return null;
      }
    },
    [clearError]
  );

  const retry = useCallback(async (): Promise<LearningMap | null> => {
    if (!lastParamsRef.current) return null;
    return generateMap(lastParamsRef.current.topic, lastParamsRef.current.options);
  }, [generateMap]);

  const retryWithRelaxed = useCallback(async (): Promise<LearningMap | null> => {
    if (!lastParamsRef.current) return null;
    const { topic, options } = lastParamsRef.current;
    const relaxedOptions: GenerationOptions = {
      ...options,
      maxDepth: Math.max(2, options.maxDepth - 1),
      maxBreadth: Math.max(2, options.maxBreadth - 1),
      maxNodes: Math.max(8, Math.floor(options.maxNodes * 0.7)),
      temperature: 0.2, // 降低溫度提高結構穩定度
    };
    return generateMap(topic, relaxedOptions);
  }, [generateMap]);

  return {
    isGenerating,
    error,
    rawOutput,
    generateMap,
    cancel,
    retry,
    retryWithRelaxed,
    clearError,
  };
}
