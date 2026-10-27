import type { LearningMap, MapNode, NodeProgress } from '../types';

/**
 * 將特殊 XML 字元進行實體跳脫
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 將學習地圖轉換為標準 OPML 2.0 格式 XML 字串
 * 支援匯入至 XMind、MindNode、OmniOutliner 等心智圖與大綱工具
 */
export function generateMapOpml(
  map: LearningMap,
  progressList: NodeProgress[] = []
): string {
  const statusMap = new Map<string, string>();
  for (const p of progressList) {
    statusMap.set(p.nodeId, p.status);
  }

  const createdRfc822 = new Date(map.createdAt).toUTCString();

  function renderOutlines(nodes: MapNode[], indentLevel = 2): string[] {
    const lines: string[] = [];
    const indent = '  '.repeat(indentLevel);

    for (const node of nodes) {
      const status = statusMap.get(node.id) || 'todo';
      const statusText = status === 'done' ? '已完成' : status === 'learning' ? '學習中' : '未開始';
      const noteParts: string[] = [];
      if (node.summary) {
        noteParts.push(node.summary);
      }
      noteParts.push(`難度: ${node.difficulty}`);
      noteParts.push(`狀態: ${statusText}`);
      const noteAttr = escapeXml(noteParts.join(' ｜ '));
      const textAttr = escapeXml(`${node.id} ${node.label}`);

      if (node.children && node.children.length > 0) {
        lines.push(`${indent}<outline text="${textAttr}" _note="${noteAttr}">`);
        lines.push(...renderOutlines(node.children, indentLevel + 1));
        lines.push(`${indent}</outline>`);
      } else {
        lines.push(`${indent}<outline text="${textAttr}" _note="${noteAttr}" />`);
      }
    }

    return lines;
  }

  const outlineLines: string[] = [];
  const rootText = escapeXml(map.title);
  const rootNote = escapeXml(map.summary || '');

  outlineLines.push(`    <outline text="${rootText}" _note="${rootNote}">`);
  if (map.root.children && map.root.children.length > 0) {
    outlineLines.push(...renderOutlines(map.root.children, 3));
  }
  outlineLines.push(`    </outline>`);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<opml version="2.0">`,
    `  <head>`,
    `    <title>${escapeXml(map.title)}</title>`,
    `    <dateCreated>${createdRfc822}</dateCreated>`,
    `    <generator>MapCraft (https://github.com/Lin-Yu-kuan/mapCraft)</generator>`,
    `  </head>`,
    `  <body>`,
    ...outlineLines,
    `  </body>`,
    `</opml>`,
  ].join('\n');
}
