export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type NodeStatus = 'todo' | 'learning' | 'done';
export type Level = 'beginner' | 'some' | 'advanced';

/** AI 產出的原始節點（未含本地狀態） */
export interface MapNode {
  id: string; // "1" / "1.2" / "1.2.3"
  label: string; // ≤ 20 字
  summary: string; // 一句話：學會這個能解決什麼
  difficulty: Difficulty;
  estMinutes?: number; // 5–180
  children?: MapNode[]; // 深度 ≤ 5
}

export interface GenerationOptions {
  maxDepth: number;
  maxBreadth: number;
  maxNodes: number;
  temperature: number;
  level: Level;
  goal?: string;
  timeBudgetHours?: number;
  language: 'zh-TW' | 'zh-CN' | 'en';
}

export interface LearningMap {
  id: string; // nanoid
  schemaVersion: 1;
  title: string;
  summary: string;
  topic: string;
  root: MapNode; // 合成根節點：id 固定 "0"，label = 主題，children = 第一層
  options: GenerationOptions;
  providerId: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

export interface NodeProgress {
  mapId: string;
  nodeId: string;
  status: NodeStatus;
  attempts: number; // 測驗次數
  correct: number;
  lastReviewedAt?: number; // P2 SRS
  updatedAt: number;
}

export interface Lesson {
  mapId: string;
  nodeId: string;
  schemaVersion: 1;
  modelId: string;
  promptVersion: string; // 例如 "lesson.zh-TW.v1"
  content: LessonContent;
  createdAt: number;
  partial?: boolean; // 使用者中途停止
}

export interface LessonContent {
  concept: string; // Markdown 150–400 字
  why: string;
  example?: {
    scenario: string;
    code?: string;
    language?: string;
    explain: string;
  };
  pitfalls: string[];
  keyPoints: string[];
  quiz?: Quiz;
}

export interface Quiz {
  question: string;
  options: string[]; // 4 個
  answerIndex: number; // 0-3
  explanation: string;
}

/** 供應商設定（金鑰獨立存放，永不進入此結構） */
export interface ProviderConfig {
  id: string; // 'openai' | 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'ollama' | 'custom'
  baseUrl: string;
  model: string;
  headers?: Record<string, string>; // 使用者自訂（Azure api-key 等）
  azure?: { apiVersion: string; deployment: string };
}
