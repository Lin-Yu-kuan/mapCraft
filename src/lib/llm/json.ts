import type { z } from 'zod';

/**
 * SPEC §5.6 JSON 容錯處理管線
 * 涵蓋：BOM 移除、Markdown 圍欄剝除、全形標點替換、尾隨逗號清除、截斷修復
 */

/**
 * 移除 UTF-8 BOM 標記
 */
export function stripBOM(str: string): string {
  if (str.charCodeAt(0) === 0xfeff) {
    return str.slice(1);
  }
  return str;
}

/**
 * 抽取原始 AI 文字中的 JSON 區塊（剝除前後無關文字與 Markdown 圍欄）
 */
export function extractJsonString(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let text = stripBOM(raw.trim());

  // 1. 匹配 Markdown ```json ... ``` 或 ``` ... ``` 圍欄
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)(?:```|$)/i;
  const match = codeBlockRegex.exec(text);
  if (match && match[1]) {
    text = match[1].trim();
  }

  // 2. 若仍夾帶前後雜訊，定位最外層的 { ... } 或 [ ... ]
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  let startIdx = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endChar = ']';
  }

  if (startIdx !== -1) {
    const lastIdx = text.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      text = text.slice(startIdx, lastIdx + 1);
    } else {
      // 截斷情況（只有開頭沒有結尾）
      text = text.slice(startIdx);
    }
  }

  return text.trim();
}

/**
 * 清理常見的格式瑕疵：全形引號、全形冒號/逗號、尾隨逗號（trailing commas）
 */
export function sanitizeJsonString(str: string): string {
  if (!str) return '';

  let result = str;

  // 1. 替換全形引號與全形標點
  result = result
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    .replace(/【/g, '[')
    .replace(/】/g, ']');

  // 2. 移除尾隨逗號（Trailing commas in objects or arrays: ,} or ,]）
  result = result.replace(/,\s*([}\]])/g, '$1');

  return result;
}

/**
 * 修復截斷的 JSON（補齊未閉合的引號與括號）
 */
export function repairTruncatedJson(str: string): string {
  let cleaned = sanitizeJsonString(str).trim();
  if (!cleaned) return '{}';

  // 追蹤未閉合狀態
  const stack: ('{' | '[')[] = [];
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  // 若字串仍在引號中，補齊引號
  if (inString) {
    cleaned += '"';
  }

  // 再次清除尾隨逗號（避免修復後出現 {"key": "val",}）
  cleaned = cleaned.replace(/,\s*$/, '');

  // 依序反向閉合括號
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') {
      cleaned += '}';
    } else if (open === '[') {
      cleaned += ']';
    }
  }

  return cleaned;
}

/**
 * 完整容錯解析與 Zod 驗證入口
 */
export function parseAndValidateJson<T>(
  raw: string,
  schema?: z.ZodType<T>
): T {
  const extracted = extractJsonString(raw);
  const sanitized = sanitizeJsonString(extracted);

  let parsed: unknown;

  // 首次直接嘗試解析
  try {
    parsed = JSON.parse(sanitized);
  } catch {
    // 首次失敗，嘗試截斷修復
    try {
      const repaired = repairTruncatedJson(sanitized);
      parsed = JSON.parse(repaired);
    } catch (secondErr) {
      throw new Error(
        `JSON 解析失敗（修復後仍無法通過）：${
          secondErr instanceof Error ? secondErr.message : String(secondErr)
        }`
      );
    }
  }

  // 若有提供 Zod Schema，執行 runtime 結構驗證
  if (schema) {
    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => `[${i.path.join('.')}] ${i.message}`)
        .join('; ');
      throw new Error(`JSON 資料驗證未通過（Schema 契約不符）：${issues}`);
    }
    return validation.data;
  }

  return parsed as T;
}
