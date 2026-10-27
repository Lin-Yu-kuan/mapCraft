import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { LearningMap, Lesson, LessonContent, MapNode, NodeMode, BrainstormContent } from '@/domain/types';
import { LessonContentSchema, BrainstormContentSchema } from '@/domain/schemas';
import {
  buildLessonRequest,
  buildBrainstormRequest,
  buildRepairRequest,
  LESSON_PROMPT_VERSION,
  LESSON_JSON_SCHEMA,
  BRAINSTORM_PROMPT_VERSION,
  BRAINSTORM_JSON_SCHEMA,
} from '@/domain/prompts';
import { findNode, getNodePath, getNodeSiblings } from '@/domain/tree';
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
  fetchLesson: (forceRegenerate?: boolean, mode?: NodeMode) => Promise<Lesson | null>;
  generateLesson: (mode?: NodeMode) => Promise<Lesson | null>;
  cancelGeneration: () => void;
  clearError: () => void;
}

export function useLesson(map: LearningMap | null, nodeId: string | null): UseLessonResult {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 取得目標節點與祖先路徑標籤
  const currentNode = useMemo(() => (map && nodeId ? findNode(map.root, nodeId) : null), [map, nodeId]);
  const pathLabels = useMemo(() => {
    if (!map || !nodeId) return '';
    return getNodePath(map.root, nodeId)
      .map((n) => n.label)
      .join(' > ');
  }, [map, nodeId]);

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

  // 執行 AI 生成內容請求（支援學習模式與腦力激盪模式）
  const executeGeneration = useCallback(
    async (targetMode: NodeMode = currentNode?.mode || 'learning'): Promise<Lesson | null> => {
      if (!map || !nodeId || !currentNode) return null;

      setError(null);
      const controller = new AbortController();
      abortControllerRef.current = controller;

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

        // 教材或發想撰寫模型
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

        const siblingLabels = getNodeSiblings(map.root, nodeId).siblings.map((s) => s.label);

        const promptParams = {
          mapTitle: map.title,
          pathLabels,
          level: map.options.level,
          nodeLabel: currentNode.label,
          nodeSummary: currentNode.summary,
          goal: map.options.goal,
          siblingLabels,
        };

        const req =
          targetMode === 'brainstorm'
            ? buildBrainstormRequest(promptParams, 0.7, controller.signal)
            : buildLessonRequest(promptParams, 0.3, controller.signal);

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

        let newLesson: Lesson;

        if (targetMode === 'brainstorm') {
          // 腦力激盪模式解析與修復
          let validatedBrainstorm: BrainstormContent | null = null;
          try {
            validatedBrainstorm = parseAndValidateJson<BrainstormContent>(
              rawText,
              BrainstormContentSchema
            );
          } catch (firstParseErr: unknown) {
            const firstErrMessage =
              firstParseErr instanceof Error ? firstParseErr.message : String(firstParseErr);

            try {
              const repairReq = buildRepairRequest(
                rawText,
                firstErrMessage,
                BRAINSTORM_JSON_SCHEMA,
                controller.signal
              );
              const repairedRes = await provider.generate(repairReq);
              validatedBrainstorm = parseAndValidateJson<BrainstormContent>(
                repairedRes.text,
                BrainstormContentSchema
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
                messageForUser: '模型回傳的發想結構有誤，自動修復重試仍無法解析。請重新嘗試。',
                raw: repairErr instanceof Error ? repairErr.message : String(repairErr),
              };
              setError(normErr);
              setIsGenerating(false);
              setIsLoading(false);
              return null;
            }
          }

          newLesson = {
            mapId: map.id,
            nodeId,
            schemaVersion: 1,
            modelId: modelToUse,
            promptVersion: BRAINSTORM_PROMPT_VERSION,
            mode: 'brainstorm',
            content: {
              concept: validatedBrainstorm.coreIdea,
              why: validatedBrainstorm.useCases.join('\n'),
              pitfalls: validatedBrainstorm.challenges,
              keyPoints: validatedBrainstorm.nextSteps,
            },
            brainstormContent: validatedBrainstorm,
            createdAt: Date.now(),
          };
        } else {
          // 學習模式解析與修復
          let validatedContent: LessonContent | null = null;
          try {
            validatedContent = parseAndValidateJson<LessonContent>(rawText, LessonContentSchema);
          } catch (firstParseErr: unknown) {
            const firstErrMessage =
              firstParseErr instanceof Error ? firstParseErr.message : String(firstParseErr);

            try {
              const repairReq = buildRepairRequest(
                rawText,
                firstErrMessage,
                LESSON_JSON_SCHEMA,
                controller.signal
              );
              const repairedRes = await provider.generate(repairReq);
              validatedContent = parseAndValidateJson<LessonContent>(
                repairedRes.text,
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
                messageForUser: '模型回傳的教材結構有誤，自動修復重試仍無法解析。請重新嘗試。',
                raw: repairErr instanceof Error ? repairErr.message : String(repairErr),
              };
              setError(normErr);
              setIsGenerating(false);
              setIsLoading(false);
              return null;
            }
          }

          newLesson = {
            mapId: map.id,
            nodeId,
            schemaVersion: 1,
            modelId: modelToUse,
            promptVersion: LESSON_PROMPT_VERSION,
            mode: 'learning',
            content: validatedContent,
            createdAt: Date.now(),
          };
        }

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

  const fetchLesson = useCallback(
    async (forceRegenerate = false, mode?: NodeMode): Promise<Lesson | null> => {
      if (!map || !nodeId) return null;

      if (!forceRegenerate) {
        setIsLoading(true);
        try {
          const cached = await lessonsRepo.get(map.id, nodeId);
          if (
            cached &&
            (cached.promptVersion === LESSON_PROMPT_VERSION ||
              cached.promptVersion === BRAINSTORM_PROMPT_VERSION)
          ) {
            setLesson(cached);
            setIsLoading(false);
            return cached;
          }
        } catch {
          // 忽略讀取快取錯誤
        }
        setIsLoading(false);
      }

      // 若強制重新生成，執行生成
      return executeGeneration(mode);
    },
    [map, nodeId, executeGeneration]
  );

  const generateLesson = useCallback(
    (mode?: NodeMode) => {
      return executeGeneration(mode);
    },
    [executeGeneration]
  );

  // 切換節點時，僅自動讀取本機快取；若無快取則停留在未生成狀態，等待使用者手動觸發
  useEffect(() => {
    cancelGeneration();
    setLesson(null);
    setError(null);

    let isMounted = true;
    async function checkCache() {
      if (!map || !nodeId) return;
      setIsLoading(true);
      try {
        const cached = await lessonsRepo.get(map.id, nodeId);
        if (isMounted) {
          if (
            cached &&
            (cached.promptVersion === LESSON_PROMPT_VERSION ||
              cached.promptVersion === BRAINSTORM_PROMPT_VERSION)
          ) {
            setLesson(cached);
          } else if (nodeId === '0') {
            // 根節點自動生成導覽
            executeGeneration('learning');
          } else {
            setLesson(null);
          }
        }
      } catch {
        if (isMounted) setLesson(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    checkCache();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id, nodeId]);

  return {
    lesson,
    currentNode,
    pathLabels,
    isLoading,
    isGenerating,
    error,
    fetchLesson,
    generateLesson,
    cancelGeneration,
    clearError,
  };
}
