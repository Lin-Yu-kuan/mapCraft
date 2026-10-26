import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

/**
 * 安全 Markdown 渲染元件（SPEC §7.3 & AGENTS.md §1.9）
 * 絕不使用 dangerouslySetInnerHTML，透過安全解析器將 Markdown 轉化為 React 虛擬 DOM
 * 天然杜絕 <script>、<iframe>、javascript:、onerror 等 XSS 攻擊
 */
export function SafeMarkdown({ content, className = '' }: SafeMarkdownProps) {
  if (!content) return null;

  // 分割行處理
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();

    // 處理程式碼區塊 ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // 結束程式碼區塊
        const codeText = codeBuffer.join('\n');
        elements.push(
          <CodeBlockItem
            key={`code-${i}`}
            code={codeText}
            language={codeLanguage}
          />
        );
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

    // 空行
    if (!trimmed) {
      elements.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // 標題 #, ##, ###
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${i}`} className="mt-3 mb-1 text-sm font-semibold text-slate-900 dark:text-white">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="mt-3.5 mb-1.5 text-base font-bold text-slate-900 dark:text-white">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="mt-4 mb-2 text-lg font-extrabold text-slate-900 dark:text-white">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // 引用塊 >
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-1.5 border-l-3 border-emerald-500 bg-emerald-50/50 py-1 pl-3 pr-2 text-xs italic text-slate-700 dark:bg-emerald-950/30 dark:text-slate-300"
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // 無序清單 - 或 *
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={`li-${i}`} className="ml-4 list-disc text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {renderInline(trimmed.slice(2))}
        </li>
      );
      continue;
    }

    // 有序清單 1. 2.
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch && orderedMatch[2]) {
      elements.push(
        <li key={`oli-${i}`} className="ml-4 list-decimal text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {renderInline(orderedMatch[2])}
        </li>
      );
      continue;
    }

    // 一般段落
    elements.push(
      <p key={`p-${i}`} className="my-1 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {renderInline(rawLine)}
      </p>
    );
  }

  // 結尾若未閉合程式碼區塊
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <CodeBlockItem
        key="code-last"
        code={codeBuffer.join('\n')}
        language={codeLanguage}
      />
    );
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
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
