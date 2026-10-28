import { z } from 'zod';
import type { MapNode } from './types';

export const DifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);
export const NodeStatusSchema = z.enum(['todo', 'learning', 'done']);
export const LevelSchema = z.enum(['beginner', 'some', 'advanced']);
export const NodeModeSchema = z.enum(['learning', 'brainstorm']);

/**
 * 節點 Schema（遞迴定義，支援子節點樹狀展開，SPEC §4.2）
 */
export const MapNodeSchema: z.ZodType<MapNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string().min(1).max(40),
    summary: z.string().min(5).max(200),
    difficulty: DifficultySchema,
    estMinutes: z.number().int().min(5).max(180).optional(),
    children: z.array(MapNodeSchema).max(8).optional(),
    mode: NodeModeSchema.optional(),
  })
);

/**
 * AI 生成地圖的原始回應 Schema（SPEC §5.3）
 */
export const MapGenerationResponseSchema = z.object({
  title: z.string().min(2).max(60),
  summary: z.string().min(10).max(200),
  nodes: z.array(MapNodeSchema).min(3).max(8),
});

export type MapGenerationResponse = z.infer<typeof MapGenerationResponseSchema>;

/**
 * 隨堂測驗 Schema（SPEC §4.2 & §5.4）
 */
export const QuizSchema = z.object({
  question: z.string().min(5),
  options: z.array(z.string()).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(5),
});

export type QuizData = z.infer<typeof QuizSchema>;

/**
 * 節點教材內容 Schema（支援 v2 引導式自由 Markdown 教學 + 向下相容 v1 結構，SPEC §5.4）
 */
export const LessonContentSchema = z
  .object({
    markdown: z.string().min(30).max(8000).optional(),
    concept: z.string().min(10).max(3000).optional(),
    why: z.string().min(2).max(1000).optional(),
    example: z
      .object({
        scenario: z.string(),
        code: z.string().nullish().transform((v) => v ?? undefined),
        language: z.string().nullish().transform((v) => v ?? undefined),
        explain: z.string(),
      })
      .optional(),
    pitfalls: z.array(z.string()).max(8).optional(),
    keyPoints: z.array(z.string()).max(8).optional(),
    quiz: QuizSchema.optional(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.markdown && data.markdown.trim().length > 0) ||
          (data.concept && data.concept.trim().length > 0)
      ),
    {
      message: '教材內容必須包含 markdown（引導式筆記）或 concept（舊版概念說明）欄位',
    }
  );

export type LessonContentData = z.infer<typeof LessonContentSchema>;

/**
 * 腦力激盪內容 Schema（固定發想框架：核心創意／應用情境／潛在挑戰／下一步行動）
 */
export const BrainstormContentSchema = z.object({
  coreIdea: z.string().min(10).max(1500),
  useCases: z.array(z.string()).min(1).max(8),
  challenges: z.array(z.string()).min(1).max(8),
  nextSteps: z.array(z.string()).min(1).max(8),
});

export type BrainstormContentData = z.infer<typeof BrainstormContentSchema>;

/**
 * 備份檔格式 Schema（SPEC §4.4 & §4.5）
 */
export const BackupSchema = z.object({
  format: z.literal('mapcraft.backup'),
  schemaVersion: z.literal(1),
  exportedAt: z.number(),
  app: z.object({
    name: z.string(),
    version: z.string(),
  }),
  maps: z.array(z.record(z.string(), z.unknown())),
  progress: z.array(z.record(z.string(), z.unknown())),
  lessons: z.array(z.record(z.string(), z.unknown())),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type BackupData = z.infer<typeof BackupSchema>;
