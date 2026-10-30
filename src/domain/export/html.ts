import type { LearningMap, NodeProgress, Lesson, MapNode } from '../types';
import { walkTree, countLearningNodes } from '../tree';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 匯出離線獨立、具備現代化高質感 UI、深淺色切換、樹狀折疊、即時搜尋、Markdown 表格渲染與隨堂測驗的單一 HTML 檔案
 */
export function generateMapHtml(
  map: LearningMap,
  progressList: NodeProgress[],
  lessons: Lesson[]
): string {
  const lessonMap = new Map<string, Lesson>();
  for (const l of lessons) {
    lessonMap.set(l.nodeId, l);
  }

  const progressMap = new Map<string, string>();
  for (const p of progressList) {
    progressMap.set(p.nodeId, p.status);
  }

  const totalCount = countLearningNodes(map.root);
  const doneCount = progressList.filter((p) => p.status === 'done').length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // 建立節點結構清單（含父節點 ID 以供階層收合控制）
  const allNodes: { node: MapNode; parentId: string | null; depth: number }[] = [];
  walkTree(map.root, (node, parent, depth) => {
    allNodes.push({ node, parentId: parent ? parent.id : null, depth });
  });

  // 產生左側心智圖樹狀 HTML
  const treeItemsHtml = allNodes
    .map(({ node, parentId, depth }) => {
      const isRoot = node.id === '0';
      const isDone = progressMap.get(node.id) === 'done';
      const hasLesson = lessonMap.has(node.id);
      const isBrainstorm = node.mode === 'brainstorm';
      const hasChildren = Boolean(node.children && node.children.length > 0);
      const paddingLeft = Math.max(0, (depth - 1) * 16) + 12;

      const difficultyLabel =
        node.difficulty === 'beginner'
          ? '入門'
          : node.difficulty === 'intermediate'
            ? '進階'
            : '精通';

      return `
        <div 
          class="tree-item ${isRoot ? 'tree-root' : ''}" 
          data-node-id="${escapeHtml(node.id)}"
          data-parent-id="${parentId ? escapeHtml(parentId) : ''}"
          data-depth="${depth}"
          style="padding-left: ${isRoot ? 12 : paddingLeft}px;"
        >
          <div class="node-card ${isDone ? 'done' : ''}" onclick="selectNode('${escapeHtml(node.id)}')">
            <div class="node-header">
              ${
                hasChildren && !isRoot
                  ? `<button type="button" class="btn-toggle" onclick="event.stopPropagation(); toggleCollapse('${escapeHtml(node.id)}')" title="收合/展開子分支" aria-label="收合/展開">▾</button>`
                  : !isRoot
                    ? `<span class="bullet-dot">•</span>`
                    : ''
              }
              ${
                !isRoot
                  ? `<span class="node-id">#${escapeHtml(node.id)}</span>`
                  : `<span class="root-badge">根主題</span>`
              }
              <span class="node-title">${escapeHtml(node.label)}</span>
              ${
                isDone
                  ? `<span class="status-badge done" title="已完成">✓</span>`
                  : ''
              }
              ${
                isBrainstorm
                  ? `<span class="mode-badge" title="腦力激盪">💡</span>`
                  : ''
              }
            </div>
            <p class="node-summary">${escapeHtml(node.summary)}</p>
            <div class="node-footer">
              ${
                !isRoot
                  ? `<span class="diff-tag diff-${escapeHtml(node.difficulty || 'beginner')}">${difficultyLabel}</span>`
                  : ''
              }
              ${
                hasLesson
                  ? `<span class="has-lesson-tag">📖 有筆記</span>`
                  : `<span class="no-lesson-tag">綱要</span>`
              }
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // 產生節點資料字典（注入前端 JS 引擎）
  const lessonDataJson = JSON.stringify(
    allNodes.map(({ node, depth }) => {
      const lesson = lessonMap.get(node.id);
      return {
        id: node.id,
        label: node.label,
        summary: node.summary,
        difficulty: node.difficulty,
        depth,
        mode: node.mode || 'learning',
        isDone: progressMap.get(node.id) === 'done',
        lesson: lesson
          ? {
              modelId: lesson.modelId,
              createdAt: new Date(lesson.createdAt).toLocaleString('zh-TW'),
              content: lesson.content,
              brainstormContent: lesson.brainstormContent,
            }
          : null,
      };
    })
  );

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(map.title)} — MapCraft 學習手冊</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --card-subtle: #f1f5f9;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --border-focus: #10b981;
      --primary: #059669;
      --primary-hover: #047857;
      --primary-light: #ecfdf5;
      --primary-border: #a7f3d0;
      --amber: #d97706;
      --amber-light: #fffbeb;
      --amber-border: #fde68a;
      --rose: #e11d48;
      --rose-light: #fff1f2;
      --rose-border: #fecdd3;
      --sky: #0284c7;
      --sky-light: #f0f9ff;
      --sky-border: #bae6fd;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
      --code-bg: #0f172a;
      --code-text: #f8fafc;
    }

    [data-theme="dark"] {
      --bg: #0b1120;
      --card-bg: #151e32;
      --card-subtle: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #1e293b;
      --border-focus: #10b981;
      --primary: #10b981;
      --primary-hover: #34d399;
      --primary-light: rgba(16, 185, 129, 0.12);
      --primary-border: rgba(16, 185, 129, 0.25);
      --amber: #f59e0b;
      --amber-light: rgba(245, 158, 11, 0.12);
      --amber-border: rgba(245, 158, 11, 0.25);
      --rose: #f43f5e;
      --rose-light: rgba(244, 63, 94, 0.12);
      --rose-border: rgba(244, 63, 94, 0.25);
      --sky: #38bdf8;
      --sky-light: rgba(56, 189, 248, 0.12);
      --sky-border: rgba(56, 189, 248, 0.25);
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
      --code-bg: #030712;
      --code-text: #e2e8f0;
    }

    @media (prefers-color-scheme: dark) {
      .theme-system {
        --bg: #0b1120;
        --card-bg: #151e32;
        --card-subtle: #1e293b;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --border: #1e293b;
        --border-focus: #10b981;
        --primary: #10b981;
        --primary-hover: #34d399;
        --primary-light: rgba(16, 185, 129, 0.12);
        --primary-border: rgba(16, 185, 129, 0.25);
        --amber: #f59e0b;
        --amber-light: rgba(245, 158, 11, 0.12);
        --amber-border: rgba(245, 158, 11, 0.25);
        --rose: #f43f5e;
        --rose-light: rgba(244, 63, 94, 0.12);
        --rose-border: rgba(244, 63, 94, 0.25);
        --sky: #38bdf8;
        --sky-light: rgba(56, 189, 248, 0.12);
        --sky-border: rgba(56, 189, 248, 0.25);
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
        --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        --code-bg: #030712;
        --code-text: #e2e8f0;
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    /* 頂部導航欄 */
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 30;
      box-shadow: var(--shadow-sm);
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }
    .header-title h1 {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.01em;
    }
    .header-title p {
      font-size: 0.75rem;
      color: var(--text-muted);
      max-width: 450px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .progress-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--card-subtle);
      border: 1px solid var(--border);
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .progress-bar-mini {
      width: 60px;
      height: 6px;
      background: var(--border);
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #059669);
      border-radius: 9999px;
      transition: width 0.3s ease;
    }
    .btn-action {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .btn-action:hover {
      background: var(--card-subtle);
      border-color: var(--border-focus);
    }

    /* 主要容器 */
    .container {
      display: flex;
      height: calc(100vh - 61px);
    }

    /* 左側樹狀導覽欄 */
    .tree-sidebar {
      width: 360px;
      min-width: 300px;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      background: var(--bg);
      flex-shrink: 0;
    }
    .search-box-wrap {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--card-bg);
    }
    .search-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 0.82rem;
      outline: none;
      transition: all 0.15s ease;
    }
    .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-light);
    }
    .tree-scroll-area {
      flex: 1;
      overflow-y: auto;
      padding: 10px 10px 24px 10px;
    }
    .tree-item {
      margin-bottom: 6px;
      transition: opacity 0.2s ease;
    }
    .tree-item.collapsed-hidden {
      display: none;
    }
    .node-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 9px 12px;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: var(--shadow-sm);
    }
    .node-card:hover {
      border-color: var(--primary);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
    .node-card.active {
      border-color: var(--primary);
      background: var(--primary-light);
      box-shadow: 0 0 0 2px var(--primary);
    }
    .node-card.done {
      border-left: 3.5px solid var(--primary);
    }
    .node-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .btn-toggle {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.8rem;
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: transform 0.2s ease;
    }
    .btn-toggle:hover {
      background: var(--border);
      color: var(--text);
    }
    .btn-toggle.collapsed {
      transform: rotate(-90deg);
    }
    .bullet-dot {
      color: var(--border);
      font-size: 0.9rem;
      width: 18px;
      text-align: center;
    }
    .node-id {
      font-size: 0.7rem;
      background: var(--card-subtle);
      color: var(--text-muted);
      padding: 1.5px 5px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .root-badge {
      font-size: 0.68rem;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 2px 7px;
      border-radius: 6px;
      font-weight: 600;
    }
    .node-title {
      color: var(--text);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-badge.done {
      color: var(--primary);
      font-weight: 800;
      font-size: 0.8rem;
      margin-left: auto;
    }
    .mode-badge {
      font-size: 0.75rem;
    }
    .node-summary {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
    }
    .node-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }
    .diff-tag {
      font-size: 0.65rem;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .diff-beginner { background: var(--primary-light); color: var(--primary); }
    .diff-intermediate { background: var(--amber-light); color: var(--amber); }
    .diff-advanced { background: var(--rose-light); color: var(--rose); }

    .has-lesson-tag {
      font-size: 0.65rem;
      color: var(--primary);
      background: var(--primary-light);
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .no-lesson-tag {
      font-size: 0.65rem;
      color: var(--text-muted);
      background: var(--card-subtle);
      padding: 1px 5px;
      border-radius: 4px;
    }

    /* 右側主要內容閱讀區 */
    .detail-panel {
      flex: 1;
      overflow-y: auto;
      padding: 36px 48px;
      background: var(--card-bg);
      scroll-behavior: smooth;
    }
    .detail-container {
      max-width: 820px;
      margin: 0 auto;
    }
    .detail-header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .detail-meta-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .detail-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.02em;
      line-height: 1.25;
    }
    .detail-summary {
      font-size: 1rem;
      color: var(--text-muted);
      margin-top: 8px;
      line-height: 1.5;
    }

    /* 區塊卡片美化（現代卡片排版） */
    .section-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
      position: relative;
      overflow: hidden;
    }
    .section-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 4px;
    }
    .section-card.primary::before { background: var(--primary); }
    .section-card.amber::before { background: var(--amber); }
    .section-card.sky::before { background: var(--sky); }
    .section-card.rose::before { background: var(--rose); }

    .section-title {
      font-size: 0.92rem;
      font-weight: 700;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title.primary { color: var(--primary); }
    .section-title.amber { color: var(--amber); }
    .section-title.sky { color: var(--sky); }
    .section-title.rose { color: var(--rose); }

    .section-body {
      font-size: 0.95rem;
      line-height: 1.75;
      color: var(--text);
    }
    .section-body p { margin-bottom: 12px; }
    .section-body p:last-child { margin-bottom: 0; }

    /* 條列項目美化 */
    .styled-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .styled-item {
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.9rem;
      line-height: 1.6;
    }

    /* Markdown 元素美化（表格、引用、標題） */
    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 0.88rem;
    }
    .markdown-content th, .markdown-content td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    .markdown-content th {
      background: var(--card-subtle);
      font-weight: 600;
      color: var(--text);
    }
    .markdown-content tr:nth-child(even) {
      background: var(--bg);
    }
    .markdown-content blockquote {
      border-left: 4px solid var(--primary);
      background: var(--primary-light);
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin: 14px 0;
      font-size: 0.92rem;
      color: var(--text);
    }
    .markdown-content h2, .markdown-content h3 {
      margin-top: 24px;
      margin-bottom: 12px;
      font-weight: 700;
      color: var(--text);
    }
    .markdown-content h2 { font-size: 1.3rem; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
    .markdown-content h3 { font-size: 1.1rem; }
    .markdown-content ul, .markdown-content ol {
      margin-left: 20px;
      margin-bottom: 14px;
    }
    .markdown-content li { margin-bottom: 6px; }

    /* 程式碼區塊（Mac 視窗樣式 + 複製按鈕） */
    .code-window {
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 10px;
      overflow: hidden;
      margin: 14px 0;
      box-shadow: var(--shadow-md);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .code-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .code-dots {
      display: flex;
      gap: 6px;
    }
    .code-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .code-dot.red { background: #ff5f56; }
    .code-dot.yellow { background: #ffbd2e; }
    .code-dot.green { background: #27c93f; }
    .code-lang {
      font-size: 0.72rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .btn-copy {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #cbd5e1;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.72rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    /* 結構與流程圖解專屬樣式（淡雅綠翡翠風格，支援深淺色自適應） */
    .diagram-window {
      background: var(--primary-light);
      border: 1px solid var(--primary-border);
      border-radius: 10px;
      overflow: hidden;
      margin: 16px 0;
      box-shadow: var(--shadow-sm);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .diagram-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background: rgba(16, 185, 129, 0.12);
      border-bottom: 1px solid var(--primary-border);
    }
    .diagram-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--primary);
    }
    .diagram-btn-copy {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid var(--primary-border);
      color: var(--primary);
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .diagram-btn-copy:hover {
      background: var(--primary);
      color: #ffffff;
    }
    .diagram-window pre {
      margin: 0;
      padding: 14px 18px;
      overflow-x: auto;
      font-size: 0.85rem;
      line-height: 1.6;
      color: var(--text);
      background: transparent;
    }
    .diagram-window code {
      color: var(--text);
      font-family: inherit;
      background: transparent;
    }
    pre {
      padding: 14px 18px;
      overflow-x: auto;
      font-size: 0.84rem;
      line-height: 1.5;
    }
    code {
      font-family: inherit;
    }
    :not(pre) > code {
      background: var(--card-subtle);
      color: var(--primary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
    }

    /* 隨堂測驗互動面板 */
    .quiz-card {
      background: var(--card-subtle);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-top: 16px;
    }
    .quiz-question {
      font-weight: 700;
      font-size: 0.95rem;
      margin-bottom: 14px;
      color: var(--text);
    }
    .quiz-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .quiz-option {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.88rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.15s ease;
    }
    .quiz-option:hover {
      border-color: var(--primary);
      background: var(--primary-light);
    }
    .quiz-option.correct {
      border-color: var(--primary);
      background: var(--primary-light);
      color: var(--primary);
      font-weight: 600;
    }
    .quiz-option.wrong {
      border-color: var(--rose);
      background: var(--rose-light);
      color: var(--rose);
    }
    .quiz-explanation {
      margin-top: 12px;
      padding: 12px;
      border-radius: 8px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      font-size: 0.85rem;
      line-height: 1.6;
      display: none;
    }

    /* 空狀態 */
    .empty-lesson {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 12px;
    }

    /* 列印樣式（PDF 最佳化） */
    @media print {
      header { position: static; box-shadow: none; border-bottom: 2px solid #000; }
      .container { height: auto; display: block; }
      .tree-sidebar, .btn-action, .search-box-wrap { display: none; }
      .detail-panel { padding: 0; }
      .section-card { break-inside: avoid; border: 1px solid #ccc; box-shadow: none; }
      .code-window { background: #f8fafc; color: #0f172a; border: 1px solid #ccc; }
      .code-topbar { background: #eee; border-bottom: 1px solid #ccc; }
      .btn-copy { display: none; }
    }

    /* 行動裝置響應式支援 */
    @media (max-width: 768px) {
      .container { flex-direction: column; height: auto; }
      .tree-sidebar { width: 100%; height: 280px; }
      .detail-panel { padding: 20px 16px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand-wrap">
      <div class="brand-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="6" r="3"></circle>
          <path d="M8.5 15.5L15.5 8.5"></path>
          <path d="M12 12l4 4"></path>
          <circle cx="17" cy="17" r="2"></circle>
        </svg>
      </div>
      <div class="header-title">
        <h1>${escapeHtml(map.title)}</h1>
        <p>${escapeHtml(map.summary)}</p>
      </div>
    </div>
    <div class="header-actions">
      <div class="progress-pill">
        <div class="progress-bar-mini">
          <div class="progress-bar-fill" id="header-progress-fill" style="width: ${percent}%;"></div>
        </div>
        <span id="header-progress-text">${doneCount} / ${totalCount} (${percent}%)</span>
      </div>
      <button class="btn-action" onclick="toggleTheme()" title="切換深淺外觀">
        <span id="theme-btn-icon">🌓</span> 外觀
      </button>
      <button class="btn-action" onclick="window.print()" title="列印或另存為 PDF 手冊">
        🖨️ 列印
      </button>
    </div>
  </header>

  <div class="container">
    <!-- 左側樹狀結構導覽 -->
    <div class="tree-sidebar">
      <div class="search-box-wrap">
        <input 
          type="text" 
          class="search-input" 
          id="node-search-input" 
          placeholder="搜尋知識節點或綱要..." 
          oninput="handleSearch(this.value)"
        />
      </div>
      <div class="tree-scroll-area" id="tree-container">
        ${treeItemsHtml}
      </div>
    </div>

    <!-- 右側內容閱覽區 -->
    <div class="detail-panel" id="detail-panel">
      <!-- 動態載入節點內容 -->
    </div>
  </div>

  <script>
    const nodeStore = ${lessonDataJson};
    let currentNodeId = nodeStore[0]?.id || '0';
    const collapsedNodes = new Set();
    const completedNodes = new Set();

    // 初始化已完成狀態
    nodeStore.forEach(n => {
      if (n.isDone) completedNodes.add(n.id);
    });

    // 穩健安全 Markdown 轉換器（完全避免字串正則貪婪與丟失，完美支援程式碼、圖解、表格、清單、粗體與引用）
    function parseSimpleMarkdown(md) {
      if (!md) return '';
      var lines = md.replace(/\\r\\n/g, '\\n').split('\\n');
      var html = '';
      var inCode = false;
      var codeBuffer = [];
      var codeLang = '';
      var inTable = false;
      var tableBuffer = [];
      var inUl = false;
      var inOl = false;

      function flushLists() {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (inOl) { html += '</ol>'; inOl = false; }
      }

      function flushTable() {
        if (!inTable) return;
        if (tableBuffer.length >= 2) {
          var tHtml = '<table><thead><tr>';
          var headerParts = tableBuffer[0].split('|');
          var headers = (headerParts.length > 2 ? headerParts.slice(1, -1) : headerParts).map(function(c) { return c.trim(); });
          headers.forEach(function(h) { tHtml += '<th>' + renderInline(h) + '</th>'; });
          tHtml += '</tr></thead><tbody>';
          for (var i = 1; i < tableBuffer.length; i++) {
            var rowText = tableBuffer[i].trim();
            if (/^\\|[\\s:-]+\\|$/.test(rowText) || /^\\|(?::?-+:?\\|)+$/.test(rowText) || /^[\\s:-]+$/.test(rowText)) {
              continue;
            }
            var rowParts = tableBuffer[i].split('|');
            var cells = (rowParts.length > 2 ? rowParts.slice(1, -1) : rowParts).map(function(c) { return c.trim(); });
            if (cells.length === 0) continue;
            tHtml += '<tr>';
            cells.forEach(function(c) { tHtml += '<td>' + renderInline(c) + '</td>'; });
            tHtml += '</tr>';
          }
          tHtml += '</tbody></table>';
          html += tHtml;
        }
        tableBuffer = [];
        inTable = false;
      }

      function renderInline(text) {
        if (!text) return '';
        var res = escapeHtml(text);
        // 行內程式碼
        res = res.replace(new RegExp('\\\\x60([^\\\\x60]+)\\\\x60', 'g'), function(_, c) {
          return '<code>' + c + '</code>';
        });
        // 粗體
        res = res.replace(/\\*\\*([^*]+)\\*\\*/g, function(_, b) {
          return '<strong>' + b + '</strong>';
        });
        // 斜體
        res = res.replace(/\\*([^*]+)\\*/g, function(_, em) {
          return '<em>' + em + '</em>';
        });
        return res;
      }

      for (var i = 0; i < lines.length; i++) {
        var rawLine = lines[i];
        var trimmed = rawLine.trim();

        // 偵測程式碼或圖解圍欄
        if (trimmed.indexOf(String.fromCharCode(96, 96, 96)) === 0 || trimmed.indexOf('~~~') === 0) {
          flushLists();
          flushTable();
          if (inCode) {
            var codeText = codeBuffer.join('\\n');
            var langLower = codeLang.toLowerCase();
            if (langLower === 'diagram' || langLower === 'ascii' || langLower === 'flowchart' || langLower === 'graph' || langLower === 'tree' || langLower === 'flow') {
              html += '<div class="diagram-window">' +
                '<div class="diagram-topbar">' +
                  '<span class="diagram-title">🗺️ 結構與流程圖解</span>' +
                  '<button class="diagram-btn-copy" onclick="copyCode(this)">複製圖解</button>' +
                '</div>' +
                '<pre><code>' + escapeHtml(codeText) + '</code></pre>' +
              '</div>';
            } else {
              html += '<div class="code-window">' +
                '<div class="code-topbar">' +
                  '<div class="code-dots"><span class="code-dot red"></span><span class="code-dot yellow"></span><span class="code-dot green"></span></div>' +
                  '<span class="code-lang">' + (codeLang || 'code') + '</span>' +
                  '<button class="btn-copy" onclick="copyCode(this)">複製程式碼</button>' +
                '</div>' +
                '<pre><code>' + escapeHtml(codeText) + '</code></pre>' +
              '</div>';
            }
            codeBuffer = [];
            codeLang = '';
            inCode = false;
          } else {
            inCode = true;
            codeLang = trimmed.slice(3).trim();
          }
          continue;
        }

        if (inCode) {
          codeBuffer.push(rawLine);
          continue;
        }

        // 偵測表格
        var isTableLine = trimmed.startsWith('|') || (trimmed.includes('|') && i + 1 < lines.length && lines[i + 1].trim().includes('|'));
        if (isTableLine) {
          flushLists();
          inTable = true;
          tableBuffer.push(trimmed);
          continue;
        } else if (inTable) {
          flushTable();
        }

        // 空行（呼吸感段落間隔）
        if (!trimmed) {
          flushLists();
          continue;
        }

        // 分隔線
        if (/^(-{3,}|\\*{3,})$/.test(trimmed)) {
          flushLists();
          html += '<hr style="border: none; border-top: 1px solid var(--border); margin: 20px 0;" />';
          continue;
        }

        // 標題 #, ##, ###, ####
        if (trimmed.startsWith('#### ')) {
          flushLists();
          html += '<h5 style="margin-top: 16px; margin-bottom: 8px; font-size: 0.95rem; font-weight: 700; color: var(--primary);">' + renderInline(trimmed.slice(5)) + '</h5>';
          continue;
        }
        if (trimmed.startsWith('### ')) {
          flushLists();
          html += '<h4 style="margin-top: 18px; margin-bottom: 10px; font-size: 1.05rem; font-weight: 700; color: var(--text);">' + renderInline(trimmed.slice(4)) + '</h4>';
          continue;
        }
        if (trimmed.startsWith('## ')) {
          flushLists();
          html += '<h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 1.25rem; font-weight: 800; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 6px;">' + renderInline(trimmed.slice(3)) + '</h3>';
          continue;
        }
        if (trimmed.startsWith('# ')) {
          flushLists();
          html += '<h2 style="margin-top: 28px; margin-bottom: 14px; font-size: 1.45rem; font-weight: 800; color: var(--text);">' + renderInline(trimmed.slice(2)) + '</h2>';
          continue;
        }

        // 引用塊 >
        if (trimmed.startsWith('>')) {
          flushLists();
          var quoteText = trimmed.replace(/^>\\s?/, '');
          html += '<blockquote>' + renderInline(quoteText) + '</blockquote>';
          continue;
        }

        // 無序清單 - 或 * 或 •
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          if (inOl) { html += '</ol>'; inOl = false; }
          if (!inUl) { html += '<ul>'; inUl = true; }
          html += '<li>' + renderInline(trimmed.slice(2)) + '</li>';
          continue;
        }

        // 有序清單 1. 2.
        var orderedMatch = trimmed.match(/^(\\d+)\\.\\s+(.+)$/);
        if (orderedMatch && orderedMatch[2]) {
          if (inUl) { html += '</ul>'; inUl = false; }
          if (!inOl) { html += '<ol>'; inOl = true; }
          html += '<li><strong>' + orderedMatch[1] + '.</strong> ' + renderInline(orderedMatch[2]) + '</li>';
          continue;
        }

        // 一般段落文字
        flushLists();
        html += '<p style="margin-bottom: 14px; line-height: 1.8;">' + renderInline(rawLine) + '</p>';
      }

      if (inCode) {
        var unclosedText = codeBuffer.join('\\n');
        var unclosedLang = codeLang.toLowerCase();
        if (unclosedLang === 'diagram' || unclosedLang === 'ascii' || unclosedLang === 'flowchart' || unclosedLang === 'graph' || unclosedLang === 'tree' || unclosedLang === 'flow') {
          html += '<div class="diagram-window">' +
            '<div class="diagram-topbar">' +
              '<span class="diagram-title">🗺️ 結構與流程圖解</span>' +
              '<button class="diagram-btn-copy" onclick="copyCode(this)">複製圖解</button>' +
            '</div>' +
            '<pre><code>' + escapeHtml(unclosedText) + '</code></pre>' +
          '</div>';
        } else {
          html += '<div class="code-window">' +
            '<div class="code-topbar">' +
              '<div class="code-dots"><span class="code-dot red"></span><span class="code-dot yellow"></span><span class="code-dot green"></span></div>' +
              '<span class="code-lang">' + (codeLang || 'code') + '</span>' +
              '<button class="btn-copy" onclick="copyCode(this)">複製程式碼</button>' +
            '</div>' +
            '<pre><code>' + escapeHtml(unclosedText) + '</code></pre>' +
          '</div>';
        }
        inCode = false;
        codeBuffer = [];
      }

      flushLists();
      flushTable();
      return html;
    }

    function copyCode(btn) {
      const container = btn.closest('.code-window') || btn.closest('.diagram-window');
      const code = container ? container.querySelector('code').innerText : '';
      navigator.clipboard.writeText(code).then(() => {
        const oldText = btn.innerText;
        btn.innerText = '已複製！';
        setTimeout(() => btn.innerText = oldText, 2000);
      });
    }

    function toggleNodeDone(id) {
      if (completedNodes.has(id)) {
        completedNodes.delete(id);
      } else {
        completedNodes.add(id);
      }
      updateDoneVisuals(id);
      updateTotalProgress();
    }

    function updateDoneVisuals(id) {
      const isDone = completedNodes.has(id);
      const card = document.querySelector('[data-node-id="' + id + '"] .node-card');
      if (card) {
        card.classList.toggle('done', isDone);
        let badge = card.querySelector('.status-badge');
        if (isDone && !badge) {
          const header = card.querySelector('.node-header');
          const span = document.createElement('span');
          span.className = 'status-badge done';
          span.title = '已完成';
          span.innerText = '✓';
          header.appendChild(span);
        } else if (!isDone && badge) {
          badge.remove();
        }
      }
      if (currentNodeId === id) {
        const btn = document.getElementById('btn-node-toggle-done');
        if (btn) {
          btn.innerText = isDone ? '✓ 已完成學習（點擊取消）' : '◯ 標記為已完成';
          btn.className = isDone ? 'btn-action done-active' : 'btn-action';
        }
      }
    }

    function updateTotalProgress() {
      const total = nodeStore.length - 1; // 扣除根主題
      const done = Array.from(completedNodes).filter(id => id !== '0').length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const fill = document.getElementById('header-progress-fill');
      const text = document.getElementById('header-progress-text');
      if (fill) fill.style.width = pct + '%';
      if (text) text.innerText = done + ' / ' + total + ' (' + pct + '%)';
    }

    function toggleCollapse(id) {
      const btn = document.querySelector('[data-node-id="' + id + '"] .btn-toggle');
      const isCollapsed = collapsedNodes.has(id);
      if (isCollapsed) {
        collapsedNodes.delete(id);
        if (btn) btn.classList.remove('collapsed');
      } else {
        collapsedNodes.add(id);
        if (btn) btn.classList.add('collapsed');
      }
      updateTreeVisibility();
    }

    function updateTreeVisibility() {
      const allItems = document.querySelectorAll('.tree-item');
      allItems.forEach(item => {
        const id = item.getAttribute('data-node-id');
        if (id === '0') return;
        // 檢查是否有任一祖先處於折疊狀態
        let currentParent = item.getAttribute('data-parent-id');
        let shouldHide = false;
        while (currentParent) {
          if (collapsedNodes.has(currentParent)) {
            shouldHide = true;
            break;
          }
          const parentEl = document.querySelector('[data-node-id="' + currentParent + '"]');
          currentParent = parentEl ? parentEl.getAttribute('data-parent-id') : null;
        }
        item.classList.toggle('collapsed-hidden', shouldHide);
      });
    }

    function handleSearch(keyword) {
      const q = keyword.trim().toLowerCase();
      const allItems = document.querySelectorAll('.tree-item');
      if (!q) {
        allItems.forEach(el => el.style.display = '');
        updateTreeVisibility();
        return;
      }
      allItems.forEach(el => {
        const id = el.getAttribute('data-node-id');
        const node = nodeStore.find(n => n.id === id);
        if (node && (node.label.toLowerCase().includes(q) || node.summary.toLowerCase().includes(q) || id.includes(q))) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      });
    }

    function selectNode(id) {
      currentNodeId = id;
      document.querySelectorAll('.node-card').forEach(c => c.classList.remove('active'));
      const activeEl = document.querySelector('[data-node-id="' + id + '"] .node-card');
      if (activeEl) activeEl.classList.add('active');
      renderDetail(id);
    }

    function answerQuiz(optionIndex, correctIndex) {
      const options = document.querySelectorAll('.quiz-option');
      const exp = document.getElementById('quiz-exp');
      options.forEach((opt, idx) => {
        opt.style.pointerEvents = 'none';
        if (idx === correctIndex) {
          opt.classList.add('correct');
        } else if (idx === optionIndex) {
          opt.classList.add('wrong');
        }
      });
      if (exp) exp.style.display = 'block';
    }

    function renderDetail(id) {
      const data = nodeStore.find(n => n.id === id);
      const panel = document.getElementById('detail-panel');
      if (!data) return;

      const isDone = completedNodes.has(id);
      let contentHtml = '';

      if (data.lesson && data.lesson.brainstormContent) {
        const b = data.lesson.brainstormContent;
        contentHtml = \`
          <div class="section-card amber">
            <div class="section-title amber">💡 核心創意</div>
            <div class="section-body"><p>\${escapeHtml(b.coreIdea)}</p></div>
          </div>

          <div class="section-card primary">
            <div class="section-title primary">🎯 應用情境</div>
            <div class="styled-list">
              \${b.useCases.map((u, i) => \`<div class="styled-item"><strong>\${i+1}.</strong> \${escapeHtml(u)}</div>\`).join('')}
            </div>
          </div>

          <div class="section-card rose">
            <div class="section-title rose">⚠️ 潛在挑戰</div>
            <div class="styled-list">
              \${b.challenges.map(c => \`<div class="styled-item">• \${escapeHtml(c)}</div>\`).join('')}
            </div>
          </div>

          <div class="section-card sky">
            <div class="section-title sky">🚀 下一步行動</div>
            <div class="styled-list">
              \${b.nextSteps.map(s => \`<div class="styled-item">➜ \${escapeHtml(s)}</div>\`).join('')}
            </div>
          </div>
        \`;
      } else if (data.lesson && data.lesson.content) {
        const c = data.lesson.content;
        if (c.markdown) {
          contentHtml = \`
            <div class="section-card primary">
              <div class="markdown-content">
                \${parseSimpleMarkdown(c.markdown)}
              </div>
            </div>
          \`;
        } else {
          contentHtml = \`
            \${c.concept ? \`
              <div class="section-card primary">
                <div class="section-title primary">📖 這是什麼</div>
                <div class="section-body"><p>\${escapeHtml(c.concept)}</p></div>
              </div>
            \` : ''}

            \${c.why ? \`
              <div class="section-card amber">
                <div class="section-title amber">❓ 為什麼重要 / 解決什麼問題</div>
                <div class="section-body"><p>\${escapeHtml(c.why)}</p></div>
              </div>
            \` : ''}

            \${c.example ? \`
              <div class="section-card sky">
                <div class="section-title sky">🛠️ 實戰範例（\${escapeHtml(c.example.scenario || '程式範例')}）</div>
                \${c.example.code ? \`
                  <div class="code-window">
                    <div class="code-topbar">
                      <div class="code-dots"><span class="code-dot red"></span><span class="code-dot yellow"></span><span class="code-dot green"></span></div>
                      <span class="code-lang">\${escapeHtml(c.example.language || 'code')}</span>
                      <button class="btn-copy" onclick="copyCode(this)">複製程式碼</button>
                    </div>
                    <pre><code>\${escapeHtml(c.example.code)}</code></pre>
                  </div>
                \` : ''}
                <div class="section-body" style="font-size: 0.88rem; color: var(--text-muted); margin-top: 8px;">
                  \${escapeHtml(c.example.explain)}
                </div>
              </div>
            \` : ''}

            \${c.pitfalls && c.pitfalls.length ? \`
              <div class="section-card rose">
                <div class="section-title rose">⚠️ 常見誤解與盲點</div>
                <div class="styled-list">
                  \${c.pitfalls.map(p => \`<div class="styled-item">• \${escapeHtml(p)}</div>\`).join('')}
                </div>
              </div>
            \` : ''}

            \${c.keyPoints && c.keyPoints.length ? \`
              <div class="section-card primary">
                <div class="section-title primary">🎯 重點回顧</div>
                <div class="styled-list">
                  \${c.keyPoints.map(k => \`<div class="styled-item">✓ \${escapeHtml(k)}</div>\`).join('')}
                </div>
              </div>
            \` : ''}
          \`;
        }

        // 附帶隨堂測驗（若有）
        if (c.quiz) {
          contentHtml += \`
            <div class="section-card sky">
              <div class="section-title sky">📝 課後隨堂測驗</div>
              <div class="quiz-card">
                <div class="quiz-question">\${escapeHtml(c.quiz.question)}</div>
                <div class="quiz-options">
                  \${c.quiz.options.map((opt, idx) => \`
                    <div class="quiz-option" onclick="answerQuiz(\${idx}, \${c.quiz.answerIndex})">
                      <span style="font-weight: 700; width: 20px;">\${String.fromCharCode(65 + idx)}.</span>
                      <span>\${escapeHtml(opt)}</span>
                    </div>
                  \`).join('')}
                </div>
                <div class="quiz-explanation" id="quiz-exp">
                  <strong>💡 解析：</strong>\${escapeHtml(c.quiz.explanation)}
                </div>
              </div>
            </div>
          \`;
        }
      } else {
        contentHtml = \`
          <div class="empty-lesson">
            <div class="empty-icon">📝</div>
            <h3 style="color: var(--text); font-size: 1.1rem; margin-bottom: 6px;">此節點尚未生成詳細教學筆記</h3>
            <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto;">可於 MapCraft 互動畫布中點選此節點，由 AI 即時生成包含引導教學、實戰範例與測驗的完整筆記。</p>
          </div>
        \`;
      }

      panel.innerHTML = \`
        <div class="detail-container">
          <div class="detail-header">
            <div class="detail-meta-bar">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="node-id">#\${escapeHtml(data.id)}</span>
                <span class="diff-tag diff-\${escapeHtml(data.difficulty || 'beginner')}">
                  \${data.difficulty === 'beginner' ? '入門' : data.difficulty === 'intermediate' ? '進階' : '精通'}
                </span>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">
                  \${data.mode === 'brainstorm' ? '💡 腦力激盪模式' : '📚 學習模式'}
                </span>
              </div>
              <button 
                type="button" 
                id="btn-node-toggle-done"
                class="btn-action \${isDone ? 'done-active' : ''}" 
                onclick="toggleNodeDone('\${escapeHtml(data.id)}')"
              >
                \${isDone ? '✓ 已完成學習（點擊取消）' : '◯ 標記為已完成'}
              </button>
            </div>
            <h2 class="detail-title">\${escapeHtml(data.label)}</h2>
            <p class="detail-summary">\${escapeHtml(data.summary)}</p>
          </div>
          \${contentHtml}
        </div>
      \`;
    }

    // 外觀切換（深色 / 淺色）
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('mapcraft_handbook_theme', next);
    }

    // 讀取暫存外觀設定
    (function initTheme() {
      const saved = localStorage.getItem('mapcraft_handbook_theme');
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
      }
    })();

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // 初始化選取第一筆節點
    selectNode(currentNodeId);
  </script>
</body>
</html>`;
}
