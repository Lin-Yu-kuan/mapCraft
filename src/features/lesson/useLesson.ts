import { useState, useEffect, useRef, useCallback } from 'react';
import { z } from 'zod';
import type { LearningMap, Lesson, LessonContent, MapNode } from '@/domain/types';
import { LessonContentSchema } from '@/domain/schemas';
import {
  buildLessonRequest,
  buildRepairRequest,
  LESSON_PROMPT_VERSION,
  LESSON_JSON_SCHEMA,
} from '@/domain/prompts';
import { findNode, getNodePath } from '@/domain/tree';
import { lessonsRepo } from '@/lib/db/repos/lessons';
import { settingsRepo } from '@/lib/db/repos/settings';
import { getStoredApiKey } from '@/lib/storage/settings';
import { createProvider } from '@/lib/llm/factory';
import { getProviderMeta } from '@/lib/llm/registry';
import { parseAndValidateJson } from '@/lib/llm/json';
import { normalizeError } from '@/lib/llm/errors';
import type { NormalizedError } from '@/lib/llm/types';

export interface UseLessonResult {
  lesson: Lesson | null;
  currentNode: MapNode | null;
  pathLabels: string;
  isLoading: boolean;
  isGenerating: boolean;
  error: NormalizedError | null;
  fetchLesson: (forceRegenerate?: boolean) => Promise<Lesson | null>;
  cancelGeneration: () => void;
  clearError: () => void;
}

export function useLesson(map: LearningMap | null, nodeId: string | null): UseLessonResult {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 取得目標節點與祖先路徑標籤（只帶路徑上下文規則，省 Token）
  const currentNode = map && nodeId ? findNode(map.root, nodeId) : null;
  const pathLabels =
    map && nodeId
      ? getNodePath(map.root, nodeId)
          .map((n) => n.label)
          .join(' > ')
      : '';

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsLoading(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchLesson = useCallback(
    async (forceRegenerate = false): Promise<Lesson | null> => {
      if (!map || !nodeId || !currentNode) return null;

      setError(null);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 1. 檢查快取（除非使用者強制重新生成，否則命中快取 0 成本直出，AC-04）
      if (!forceRegenerate) {
        setIsLoading(true);
        try {
          const cached = await lessonsRepo.get(map.id, nodeId);
          if (cached && cached.promptVersion === LESSON_PROMPT_VERSION) {
            setLesson(cached);
            setIsLoading(false);
            return cached;
          }
        } catch {
          // 忽略讀取快取失敗，直接進入生成流程
        }
      }

      // 2. 快取未命中或強制重新生成：呼叫 LLM
      setIsGenerating(true);
      setIsLoading(true);

      try {
        const appSettings = await settingsRepo.getSettings();
        const providerId = appSettings.lastProviderId || map.providerId || 'openai';
        const meta = getProviderMeta(providerId);

        const apiKey = getStoredApiKey(providerId);
        if (!apiKey && providerId !== 'ollama') {
          const err: NormalizedError = {
            code: 'UNAUTHORIZED',
            providerId,
            messageForUser: '尚未填寫 API 金鑰，請先至設定頁面設定金鑰後再生成教材。',
          };
          setError(err);
          setIsGenerating(false);
          setIsLoading(false);
          return null;
        }

        // 教材撰寫模型（偏好深度與教學品質，優先使用 lastLessonModelId）
        const defaultLessonModel =
          meta?.recommendedModels.find((m) => m.role === 'lesson' || m.role === 'both')?.id ||
          meta?.recommendedModels[0]?.id ||
          'gpt-4o';
        const modelToUse = appSettings.lastLessonModelId || defaultLessonModel;

        const provider = createProvider(
          {
            id: providerId,
            baseUrl: meta?.defaultBaseUrl || 'https://api.openai.com/v1',
            model: modelToUse,
          },
          apiKey
        );

        const req = buildLessonRequest(
          {
            mapTitle: map.title,
            pathLabels,
            level: map.options.level,
            nodeLabel: currentNode.label,
            nodeSummary: currentNode.summary,
          },
          0.3,
          controller.signal
        );

        let rawText = '';
        try {
          const genRes = await provider.generate(req);
          rawText = genRes.text;
        } catch (fetchErr: unknown) {
          if (controller.signal.aborted) {
            setIsGenerating(false);
            setIsLoading(false);
            return null;
          }
          const normErr = normalizeError(fetchErr, providerId);
          setError(normErr);
          setIsGenerating(false);
          setIsLoading(false);
          return null;
        }

        // 解析與驗證
        let parsedRawContent: z.infer<typeof LessonContentSchema> | null = null;
        try {
          parsedRawContent = parseAndValidateJson<z.infer<typeof LessonContentSchema>>(
            rawText,
            LessonContentSchema
          );
        } catch (parseErr: unknown) {
          // 自動修復重試 1 次
          const firstErr = parseErr instanceof Error ? parseErr.message : String(parseErr);
          try {
            const repairReq = buildRepairRequest(
              rawText,
              firstErr,
              LESSON_JSON_SCHEMA,
              controller.signal
            );
            const repairRes = await provider.generate(repairReq);
            parsedRawContent = parseAndValidateJson<z.infer<typeof LessonContentSchema>>(
              repairRes.text,
              LessonContentSchema
            );
          } catch (repairErr: unknown) {
            if (controller.signal.aborted) {
              setIsGenerating(false);
              setIsLoading(false);
              return null;
            }
            const normErr: NormalizedError = {
              code: 'PARSE_ERROR',
              providerId,
              messageForUser: '模型回傳的教材內容結構不符規範，已嘗試自動修復仍無法解析。',
              raw: repairErr instanceof Error ? repairErr.message : String(repairErr),
            };
            setError(normErr);
            setIsGenerating(false);
            setIsLoading(false);
            return null;
          }
        }

        const validatedContent: LessonContent = {
          concept: parsedRawContent.concept,
          why: parsedRawContent.why,
          pitfalls: parsedRawContent.pitfalls,
          keyPoints: parsedRawContent.keyPoints,
          example: parsedRawContent.example
            ? {
                scenario: parsedRawContent.example.scenario,
                explain: parsedRawContent.example.explain,
                code: parsedRawContent.example.code ?? undefined,
                language: parsedRawContent.example.language ?? undefined,
              }
            : undefined,
          quiz: parsedRawContent.quiz,
        };

        const newLesson: Lesson = {
          mapId: map.id,
          nodeId,
          schemaVersion: 1,
          modelId: modelToUse,
          promptVersion: LESSON_PROMPT_VERSION,
          content: validatedContent,
          createdAt: Date.now(),
        };

        // 存入 Dexie 快取
        await lessonsRepo.save(newLesson);
        setLesson(newLesson);
        setIsGenerating(false);
        setIsLoading(false);
        return newLesson;
      } catch (unknownErr: unknown) {
        if (controller.signal.aborted) {
          setIsGenerating(false);
          setIsLoading(false);
          return null;
        }
        const normErr = normalizeError(unknownErr, 'unknown');
        setError(normErr);
        setIsGenerating(false);
        setIsLoading(false);
        return null;
      }
    },
    [map, nodeId, currentNode, pathLabels]
  );

  // 當切換節點時，立即清理舊內容，並自動觸發讀取（符合 AC-04）
  useEffect(() => {
    cancelGeneration();
    setLesson(null);
    setError(null);

    if (map && nodeId) {
      fetchLesson(false);
    }
  }, [map, nodeId, cancelGeneration, fetchLesson]);

  return {
    lesson,
    currentNode,
    pathLabels,
    isLoading,
    isGenerating,
    error,
    fetchLesson,
    cancelGeneration,
    clearError,
  };
}
