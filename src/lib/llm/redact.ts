/**
 * SPEC §7.1 金鑰遮罩（Redaction）
 * 確保任何 API Key 都不會出現在 Log、URL、錯誤訊息、DOM 或匯出檔案中。
 */

const KEY_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /AQ\.[A-Za-z0-9_.-]{16,}/g,
  /ya29\.[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9_.-]+/g,
];

/**
 * 遮罩字串中的金鑰，僅保留前 3 碼與後 4 碼（例如 sk-...abcd）
 */
export function maskKey(key: string): string {
  if (!key || key.length <= 8) {
    return '***';
  }
  const start = key.slice(0, 3);
  const end = key.slice(-4);
  return `${start}…${end}`;
}

/**
 * 掃描並替換文字中的任何潛在金鑰特徵
 */
export function redact(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let result = text;
  for (const pattern of KEY_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (match.startsWith('Bearer ')) {
        const token = match.slice(7);
        return `Bearer ${maskKey(token)}`;
      }
      return maskKey(match);
    });
  }
  return result;
}
