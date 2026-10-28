import { useState } from 'react';
import { Copy, Check, Network } from 'lucide-react';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

const DIAGRAM_LANGUAGES = new Set(['diagram', 'ascii', 'flowchart', 'graph', 'tree', 'flow']);

/**
 * 判斷是否為 Markdown 表格分隔列（例如 | --- | :--- | :---: |）
 */
function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = parseTableRow(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

/**
 * 解析單行 Markdown 表格儲存格
 */
function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

/**
 * 安全 Markdown 渲染元件（SPEC §7.3 & AGENTS.md §1.9）
 * 絕不使用 dangerouslySetInnerHTML，透過安全解析器將 Markdown 轉化為 React 虛擬 DOM
 * 天然杜絕 <script>、<iframe>、javascript:、onerror 等 XSS 攻擊
 * 支援：分段、標題、粗體/斜體/行內碼、清單、引用塊、Markdown 表格、結構圖解區塊與程式碼區塊
 */
export function SafeMarkdown({ content, className = '' }: SafeMarkdownProps) {
  if (!content) return null;

  // 正規化換行符號
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = '';

  let inTable = false;
  let tableBuffer: string[] = [];

  const flushTable = (keyIndex: number) => {
    if (tableBuffer.length === 0) return;

    // 檢查是否有表頭分隔列
    const hasSeparator = tableBuffer.length >= 2 && isTableSeparatorLine(tableBuffer[1] ?? '');
    const headerCells = parseTableRow(tableBuffer[0] ?? '');
    const bodyStartIndex = hasSeparator ? 2 : 1;
    const bodyRows = tableBuffer
      .slice(bodyStartIndex)
      .filter((r) => !isTableSeparatorLine(r))
      .map(parseTableRow);

    elements.push(
      <div
        key={`table-${keyIndex}`}
        className="my-3 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs dark:border-slate-800"
      >
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
              {headerCells.map((cell, cIdx) => (
                <th key={`th-${cIdx}`} className="px-3 py-2 font-bold">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 bg-white dark:divide-slate-800/70 dark:bg-slate-950/60">
            {bodyRows.map((row, rIdx) => (
              <tr
                key={`tr-${rIdx}`}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
              >
                {headerCells.map((_, cIdx) => (
                  <td
                    key={`td-${rIdx}-${cIdx}`}
                    className="px-3 py-2 leading-relaxed text-slate-700 dark:text-slate-300"
                  >
                    {renderInline(row[cIdx] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    tableBuffer = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    // 處理程式碼或圖解區塊 ```
    if (trimmed.startsWith('```')) {
      if (inTable) {
        flushTable(i);
      }
      if (inCodeBlock) {
        // 結束程式碼區塊
        const codeText = codeBuffer.join('\n');
        const langLower = codeLanguage.toLowerCase();
        if (DIAGRAM_LANGUAGES.has(langLower)) {
          elements.push(<DiagramBlockItem key={`diagram-${i}`} diagram={codeText} />);
        } else {
          elements.push(
            <CodeBlockItem key={`code-${i}`} code={codeText} language={codeLanguage} />
          );
        }
        codeBuffer = [];
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        // 開始程式碼區塊
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // 偵測 Markdown 表格列（以 | 開頭或包含 | 且下一行是分隔列）
    const isTableLine =
      trimmed.startsWith('|') ||
      (trimmed.includes('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1] ?? ''));

    if (isTableLine) {
      inTable = true;
      tableBuffer.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    // 空行（提供清晰的段落間距）
    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-2.5" />);
      continue;
    }

    // 水平分隔線 --- 或 ***
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      elements.push(
        <hr
          key={`hr-${i}`}
          className="my-3 border-slate-200 dark:border-slate-800"
        />
      );
      continue;
    }

    // 標題 #, ##, ###, ####
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h5
          key={`h5-${i}`}
          className="mt-3 mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400"
        >
          {renderInline(trimmed.slice(5))}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4
          key={`h4-${i}`}
          className="mt-4 mb-1.5 text-sm font-bold text-slate-900 dark:text-white"
        >
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="mt-5 mb-2 flex items-center gap-1.5 border-b border-slate-200/80 pb-1.5 text-sm sm:text-base font-bold text-slate-900 dark:border-slate-800 dark:text-white"
        >
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="mt-5 mb-2 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white"
        >
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // 引用塊 >
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s?/, '');
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2.5 rounded-r-xl border-l-3 border-emerald-500 bg-emerald-50/60 py-2 pl-3.5 pr-3 text-xs sm:text-sm leading-relaxed text-slate-700 dark:bg-emerald-950/30 dark:text-slate-300"
        >
          {renderInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    // 無序清單 - 或 * 或 •
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      elements.push(
        <li
          key={`li-${i}`}
          className="ml-4 my-1 list-disc text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {renderInline(trimmed.slice(2))}
        </li>
      );
      continue;
    }

    // 有序清單 1. 2.
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch && orderedMatch[2]) {
      elements.push(
        <li
          key={`oli-${i}`}
          className="ml-4 my-1 list-decimal text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300"
        >
          {renderInline(orderedMatch[2])}
        </li>
      );
      continue;
    }

    // 一般段落
    elements.push(
      <p
        key={`p-${i}`}
        className="my-1.5 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300"
      >
        {renderInline(rawLine)}
      </p>
    );
  }

  // 結尾若尚有未輸出的表格
  if (inTable && tableBuffer.length > 0) {
    flushTable(lines.length);
  }

  // 結尾若未閉合程式碼區塊
  if (inCodeBlock && codeBuffer.length > 0) {
    const codeText = codeBuffer.join('\n');
    const langLower = codeLanguage.toLowerCase();
    if (DIAGRAM_LANGUAGES.has(langLower)) {
      elements.push(<DiagramBlockItem key="diagram-last" diagram={codeText} />);
    } else {
      elements.push(<CodeBlockItem key="code-last" code={codeText} language={codeLanguage} />);
    }
  }

  return <div className={`space-y-1.5 ${className}`}>{elements}</div>;
}

/**
 * 視覺化結構圖／流程圖區塊（ASCII / Unicode 方塊箭頭圖解）
 */
function DiagramBlockItem({ diagram }: { diagram: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex items-center gap-1.5 border-b border-emerald-200/60 bg-emerald-100/50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300">
        <Network className="h-3.5 w-3.5" />
        <span>結構與流程圖解</span>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
        <code>{diagram}</code>
      </pre>
    </div>
  );
}

/**
 * 程式碼區塊（含一鍵複製）
 */
function CodeBlockItem({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group relative my-2.5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[11px] text-slate-400">
        <span className="font-mono">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="複製程式碼"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">已複製</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>複製</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * 處理行內樣式：**粗體**、*斜體*、`行內程式碼`
 */
function renderInline(text: string): React.ReactNode[] {
  // 正則比對 **粗體** 或 `程式碼`
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // 匹配前的純文字
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-bold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`c-${match.index}`}
          className="rounded-md bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-emerald-700 dark:bg-slate-800 dark:text-emerald-400"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`i-${match.index}`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
