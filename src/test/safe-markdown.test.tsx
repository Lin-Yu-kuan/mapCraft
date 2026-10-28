import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SafeMarkdown } from '@/shared/components/SafeMarkdown';

describe('SafeMarkdown Component (SPEC §7.3 & AGENTS.md §1.9 XSS Defense)', () => {
  it('防禦 XSS 攻擊：<script> 與 <img> onerror 標籤純文字化，絕不注入為 HTML DOM', () => {
    const malicious = `
# 安全測試
這是正常文字。
<script>alert("hacked")</script>
<img src="x" onerror="alert(1)" />
    `;

    const { container } = render(<SafeMarkdown content={malicious} />);

    // 斷言 DOM 中不存在 script 標籤
    expect(container.querySelector('script')).toBeNull();
    // 斷言 DOM 中不存在帶有 onerror 屬性的 img 標籤
    expect(container.querySelector('img[onerror]')).toBeNull();

    // 原始文字安全顯示為純文字內容
    expect(screen.getByText(/<script>alert\("hacked"\)<\/script>/)).toBeInTheDocument();
  });

  it('正確渲染標題、無序列表、粗體與行內程式碼', () => {
    const content = `
### 核心概念
- 第一點：**重要觀念**
- 第二點：請使用 \`npm run build\` 指令
    `;

    render(<SafeMarkdown content={content} />);

    expect(screen.getByRole('heading', { level: 4, name: '核心概念' })).toBeInTheDocument();
    expect(screen.getByText('重要觀念')).toBeInTheDocument();
    expect(screen.getByText('npm run build')).toBeInTheDocument();
  });

  it('支援程式碼區塊渲染與複製按鈕', () => {
    const codeMarkdown = `
\`\`\`typescript
const greeting: string = "Hello MapCraft";
\`\`\`
    `;

    render(<SafeMarkdown content={codeMarkdown} />);

    expect(screen.getByText(/const greeting: string/)).toBeInTheDocument();
    expect(screen.getByLabelText('複製程式碼')).toBeInTheDocument();
  });

  it('支援 Markdown 比較表格與結構圖解區塊渲染', () => {
    const richMarkdown = `
## 比較表格與圖解

| 方式 | 優點 |
| :--- | :--- |
| **靜態檢查** | 編譯期抓錯 |

\`\`\`diagram
[前端] ──請求──> [API]
\`\`\`
    `;

    const { container } = render(<SafeMarkdown content={richMarkdown} />);

    expect(container.querySelector('table')).not.toBeNull();
    expect(screen.getByText('靜態檢查')).toBeInTheDocument();
    expect(screen.getByText('編譯期抓錯')).toBeInTheDocument();
    expect(screen.getByText('結構與流程圖解')).toBeInTheDocument();
    expect(screen.getByText(/\[前端\] ──請求──> \[API\]/)).toBeInTheDocument();
  });
});
