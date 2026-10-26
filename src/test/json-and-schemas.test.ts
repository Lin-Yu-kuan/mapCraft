import { describe, it, expect } from 'vitest';
import {
  extractJsonString,
  sanitizeJsonString,
  repairTruncatedJson,
  parseAndValidateJson,
} from '@/lib/llm/json';
import {
  MapGenerationResponseSchema,
  LessonContentSchema,
  BackupSchema,
} from '@/domain/schemas';
import mapSmall from './fixtures/map.small.json';
import lessonFixture from './fixtures/lesson.json';

describe('JSON Extraction, Sanitization & Repair (SPEC §5.6 & AGENTS.md §5)', () => {
  it('strips UTF-8 BOM properly', () => {
    const withBOM = '\uFEFF{"title": "BOM Test", "summary": "Valid summary text", "nodes": []}';
    const extracted = extractJsonString(withBOM);
    expect(extracted.charCodeAt(0)).not.toBe(0xfeff);
    const parsed = JSON.parse(extracted);
    expect(parsed.title).toBe('BOM Test');
  });

  it('extracts JSON enclosed in markdown code fences with conversational noise', () => {
    const rawAiOutput = `
Here is the learning map you requested:
\`\`\`json
{
  "title": "測試地圖",
  "summary": "這是一個測試用的學習地圖摘要",
  "nodes": []
}
\`\`\`
Hope this helps your learning!
    `;

    const extracted = extractJsonString(rawAiOutput);
    expect(extracted).not.toContain('Here is the learning map');
    expect(extracted).not.toContain('Hope this helps');
    const parsed = JSON.parse(extracted);
    expect(parsed.title).toBe('測試地圖');
  });

  it('sanitizes full-width quotes and punctuation', () => {
    const fullWidthRaw = '{\n  “title”： “全形引號測試”，\n  “summary”： “全形標點替換測試”\n}';
    const sanitized = sanitizeJsonString(fullWidthRaw);
    expect(sanitized).not.toContain('“');
    expect(sanitized).not.toContain('”');
    expect(sanitized).not.toContain('：');
    const parsed = JSON.parse(sanitized);
    expect(parsed.title).toBe('全形引號測試');
  });

  it('removes trailing commas in objects and arrays', () => {
    const trailingCommaJson = `
    {
      "title": "尾隨逗號測試",
      "items": [
        "item1",
        "item2",
      ],
      "meta": {
        "depth": 3,
      },
    }
    `;
    const sanitized = sanitizeJsonString(trailingCommaJson);
    const parsed = JSON.parse(sanitized);
    expect(parsed.items.length).toBe(2);
    expect(parsed.meta.depth).toBe(3);
  });

  it('repairs truncated JSON with unclosed strings and braces', () => {
    // 模擬 AI 在輸出到一半時被 maxOutputTokens 截斷
    const truncated = '{"title": "截斷地圖", "summary": "這是一段尚未寫完的摘要文字';
    const repaired = repairTruncatedJson(truncated);
    const parsed = JSON.parse(repaired);
    expect(parsed.title).toBe('截斷地圖');
    expect(parsed.summary).toContain('這是一段尚未寫完的摘要文字');
  });

  it('repairs nested truncated JSON with arrays and objects', () => {
    const nestedTruncated = '{"nodes": [{"id": "1", "label": "節點1", "children": [{"id": "1.1"';
    const repaired = repairTruncatedJson(nestedTruncated);
    const parsed = JSON.parse(repaired);
    expect(parsed.nodes[0].children[0].id).toBe('1.1');
  });

  describe('Zod Schema Validation (SPEC §5.3, §5.4, §4.4)', () => {
    it('validates valid map fixture with MapGenerationResponseSchema', () => {
      const parsed = parseAndValidateJson(
        JSON.stringify(mapSmall),
        MapGenerationResponseSchema
      );
      expect(parsed.title).toBe('Spring Boot 核心概念');
      expect(parsed.nodes.length).toBe(3);
    });

    it('rejects map with fewer than 3 nodes', () => {
      const invalidMap = {
        title: '太短的地圖',
        summary: '只有兩個節點不符契約',
        nodes: [
          { id: '1', label: '點1', summary: '摘要1', difficulty: 'beginner' },
          { id: '2', label: '點2', summary: '摘要2', difficulty: 'beginner' },
        ],
      };

      expect(() =>
        parseAndValidateJson(JSON.stringify(invalidMap), MapGenerationResponseSchema)
      ).toThrowError(/expected array to have >=3 items/i);
    });

    it('validates lesson fixture with LessonContentSchema', () => {
      const parsed = parseAndValidateJson(
        JSON.stringify(lessonFixture),
        LessonContentSchema
      );
      expect(parsed.concept).toContain('依賴注入');
      expect(parsed.pitfalls.length).toBe(2);
      expect(parsed.quiz?.options.length).toBe(4);
      expect(parsed.quiz?.answerIndex).toBe(0);
    });

    it('validates backup fixture with BackupSchema', () => {
      const backupData = {
        format: 'mapcraft.backup',
        schemaVersion: 1,
        exportedAt: 1761436800000,
        app: { name: 'MapCraft', version: '0.1.0' },
        maps: [],
        progress: [],
        lessons: [],
      };

      const parsed = parseAndValidateJson(
        JSON.stringify(backupData),
        BackupSchema
      );
      expect(parsed.format).toBe('mapcraft.backup');
    });

    it('rejects backup with invalid format identifier', () => {
      const invalidBackup = {
        format: 'wrong.backup',
        schemaVersion: 1,
        exportedAt: 1761436800000,
        app: { name: 'MapCraft', version: '0.1.0' },
        maps: [],
        progress: [],
        lessons: [],
      };

      expect(() =>
        parseAndValidateJson(JSON.stringify(invalidBackup), BackupSchema)
      ).toThrowError(/expected "mapcraft.backup"/i);
    });
  });
});
