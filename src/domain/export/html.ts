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
 * 匯出離線獨立、具備互動心智圖與詳細筆記閱覽的單一 HTML 檔案
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

  // 建立節點清單
  const allNodes: { node: MapNode; depth: number }[] = [];
  walkTree(map.root, (node, _parent, depth) => {
    allNodes.push({ node, depth });
  });

  // 產生心智圖樹狀 HTML
  const treeItemsHtml = allNodes
    .map(({ node, depth }) => {
      const isRoot = node.id === '0';
      const isDone = progressMap.get(node.id) === 'done';
      const hasLesson = lessonMap.has(node.id);
      const isBrainstorm = node.mode === 'brainstorm';

      const paddingLeft = depth * 20;

      return `
        <div 
          class="tree-node ${isRoot ? 'tree-root' : ''}" 
          data-node-id="${escapeHtml(node.id)}"
          style="padding-left: ${paddingLeft}px;"
          onclick="selectNode('${escapeHtml(node.id)}')"
        >
          <div class="node-card ${isDone ? 'done' : ''}">
            <div class="node-header">
              ${
                !isRoot
                  ? `<span class="node-id">#${escapeHtml(node.id)}</span>`
                  : `<span class="root-badge">根主題</span>`
              }
              <span class="node-title">${escapeHtml(node.label)}</span>
              ${
                isDone
                  ? `<span class="done-badge" title="已完成">✓</span>`
                  : ''
              }
              ${
                isBrainstorm
                  ? `<span class="mode-badge" title="腦力激盪">💡</span>`
                  : ''
              }
            </div>
            <p class="node-summary">${escapeHtml(node.summary)}</p>
            ${
              hasLesson
                ? `<span class="has-lesson-tag">📖 有筆記</span>`
                : `<span class="no-lesson-tag">綱要</span>`
            }
          </div>
        </div>
      `;
    })
    .join('');

  // 產生右側筆記內容字典（以 script 或 JSON 注入）
  const lessonDataJson = JSON.stringify(
    allNodes.map(({ node }) => {
      const lesson = lessonMap.get(node.id);
      return {
        id: node.id,
        label: node.label,
        summary: node.summary,
        difficulty: node.difficulty,
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
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --primary: #059669;
      --primary-light: #ecfdf5;
      --amber: #d97706;
      --amber-light: #fffbeb;
      --rose: #e11d48;
      --rose-light: #fff1f2;
      --sky: #0284c7;
      --sky-light: #f0f9ff;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #090d16;
        --card-bg: #111827;
        --text: #f8fafc;
        --muted: #94a3b8;
        --border: #1e293b;
        --primary: #10b981;
        --primary-light: #064e3b;
        --amber: #f59e0b;
        --amber-light: #451a03;
        --rose: #f43f5e;
        --rose-light: #4c0519;
        --sky: #38bdf8;
        --sky-light: #082f49;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .header-title h1 { font-size: 1.25rem; font-weight: 700; color: var(--primary); }
    .header-title p { font-size: 0.8rem; color: var(--muted); }
    .header-stats {
      font-size: 0.85rem;
      background: var(--primary-light);
      color: var(--primary);
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 600;
    }
    .btn-print {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      margin-left: 10px;
    }
    .btn-print:hover { background: var(--bg); }
    .container {
      display: flex;
      height: calc(100vh - 65px);
    }
    .tree-sidebar {
      width: 380px;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 16px;
      background: var(--bg);
    }
    .tree-node {
      margin-bottom: 8px;
    }
    .node-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .node-card:hover {
      border-color: var(--primary);
      transform: translateY(-1px);
    }
    .node-card.active {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--primary);
    }
    .node-card.done {
      border-left: 4px solid var(--primary);
    }
    .node-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .node-id {
      font-size: 0.7rem;
      background: var(--border);
      padding: 2px 5px;
      border-radius: 4px;
    }
    .root-badge {
      font-size: 0.7rem;
      background: var(--primary);
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .done-badge {
      color: var(--primary);
      margin-left: auto;
      font-weight: bold;
    }
    .node-summary {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .has-lesson-tag {
      display: inline-block;
      font-size: 0.65rem;
      color: var(--primary);
      background: var(--primary-light);
      padding: 1px 6px;
      border-radius: 4px;
      margin-top: 6px;
    }
    .no-lesson-tag {
      display: inline-block;
      font-size: 0.65rem;
      color: var(--muted);
      padding: 1px 6px;
      margin-top: 6px;
    }
    .detail-panel {
      flex: 1;
      overflow-y: auto;
      padding: 32px 48px;
      background: var(--card-bg);
    }
    .detail-header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .detail-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
    }
    .detail-summary {
      font-size: 0.95rem;
      color: var(--muted);
      margin-top: 4px;
    }
    .section-block {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-title.amber { color: var(--amber); }
    .section-title.primary { color: var(--primary); }
    .section-title.rose { color: var(--rose); }
    .section-title.sky { color: var(--sky); }
    .list-item {
      padding: 8px 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 0.85rem;
    }
    pre {
      background: #1e293b;
      color: #f8fafc;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.8rem;
      margin: 10px 0;
    }
    @media print {
      header { position: static; }
      .container { height: auto; display: block; }
      .tree-sidebar { width: 100%; border-right: none; page-break-after: always; }
      .btn-print { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-title">
      <h1>${escapeHtml(map.title)}</h1>
      <p>${escapeHtml(map.summary)}</p>
    </div>
    <div style="display: flex; align-items: center;">
      <div class="header-stats">進度：${doneCount} / ${totalCount} (${percent}%)</div>
      <button class="btn-print" onclick="window.print()">🖨️ 列印 / 存為 PDF</button>
    </div>
  </header>

  <div class="container">
    <div class="tree-sidebar">
      ${treeItemsHtml}
    </div>

    <div class="detail-panel" id="detail-panel">
      <!-- 預設動態載入選取節點 -->
    </div>
  </div>

  <script>
    const nodeStore = ${lessonDataJson};
    let currentNodeId = nodeStore[0]?.id || '0';

    function selectNode(id) {
      currentNodeId = id;
      document.querySelectorAll('.node-card').forEach(c => c.classList.remove('active'));
      const activeEl = document.querySelector('[data-node-id="' + id + '"] .node-card');
      if (activeEl) activeEl.classList.add('active');
      renderDetail(id);
    }

    function renderDetail(id) {
      const data = nodeStore.find(n => n.id === id);
      const panel = document.getElementById('detail-panel');
      if (!data) return;

      let contentHtml = '';

      if (data.lesson && data.lesson.brainstormContent) {
        const b = data.lesson.brainstormContent;
        contentHtml = \`
          <div class="section-block">
            <div class="section-title amber">💡 核心創意</div>
            <p style="font-size: 0.95rem; line-height: 1.7;">\${escapeHtml(b.coreIdea)}</p>
          </div>

          <div class="section-block">
            <div class="section-title primary">🎯 應用情境</div>
            \${b.useCases.map((u, i) => \`<div class="list-item">\${i+1}. \${escapeHtml(u)}</div>\`).join('')}
          </div>

          <div class="section-block">
            <div class="section-title rose">⚠️ 潛在挑戰</div>
            \${b.challenges.map(c => \`<div class="list-item">• \${escapeHtml(c)}</div>\`).join('')}
          </div>

          <div class="section-block">
            <div class="section-title sky">🚀 下一步行動</div>
            \${b.nextSteps.map(s => \`<div class="list-item">➜ \${escapeHtml(s)}</div>\`).join('')}
          </div>
        \`;
      } else if (data.lesson && data.lesson.content) {
        const c = data.lesson.content;
        contentHtml = \`
          <div class="section-block">
            <div class="section-title primary">📖 這是什麼</div>
            <p style="font-size: 0.95rem; line-height: 1.7;">\${escapeHtml(c.concept)}</p>
          </div>

          <div class="section-block">
            <div class="section-title amber">❓ 為什麼重要 / 解決什麼問題</div>
            <p style="font-size: 0.95rem;">\${escapeHtml(c.why)}</p>
          </div>

          \${c.example ? \`
            <div class="section-block">
              <div class="section-title sky">🛠️ 實戰範例（\${escapeHtml(c.example.scenario)}）</div>
              \${c.example.code ? \`<pre><code>\${escapeHtml(c.example.code)}</code></pre>\` : ''}
              <p style="font-size: 0.85rem; color: var(--muted);">\${escapeHtml(c.example.explain)}</p>
            </div>
          \` : ''}

          \${c.pitfalls && c.pitfalls.length ? \`
            <div class="section-block">
              <div class="section-title rose">⚠️ 常見誤解與盲點</div>
              \${c.pitfalls.map(p => \`<div class="list-item">• \${escapeHtml(p)}</div>\`).join('')}
            </div>
          \` : ''}

          \${c.keyPoints && c.keyPoints.length ? \`
            <div class="section-block">
              <div class="section-title primary">🎯 重點回顧</div>
              \${c.keyPoints.map(k => \`<div class="list-item">✓ \${escapeHtml(k)}</div>\`).join('')}
            </div>
          \` : ''}
        \`;
      } else {
        contentHtml = \`
          <div class="section-block" style="text-align: center; padding: 40px 20px;">
            <p style="font-size: 1rem; color: var(--muted); margin-bottom: 8px;">此節點尚未生成詳細教學筆記</p>
            <p style="font-size: 0.85rem; color: var(--muted);">可在 MapCraft 畫布中點擊該節點，由 AI 生成結構化教材或腦力激盪發想。</p>
          </div>
        \`;
      }

      panel.innerHTML = \`
        <div class="detail-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="node-id">#\${escapeHtml(data.id)}</span>
            <span style="font-size: 0.8rem; color: var(--primary); font-weight: 600;">\${data.mode === 'brainstorm' ? '💡 腦力激盪模式' : '📚 學習模式'}</span>
            \${data.isDone ? '<span style="font-size: 0.8rem; color: var(--primary); margin-left: auto;">✅ 已完成學習</span>' : ''}
          </div>
          <h2 class="detail-title">\${escapeHtml(data.label)}</h2>
          <p class="detail-summary">\${escapeHtml(data.summary)}</p>
        </div>
        \${contentHtml}
      \`;
    }

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
