import type { LearningMap, MapNode, NodeProgress, Lesson } from '../types';
import { countLearningNodes } from '../tree';

/**
 * 依照 SPEC 附錄 B 格式產出完整的學習手冊 Markdown
 * 包含地圖階層、完成度標記、知識點摘要、教材精華重點與常見誤解
 */
export function generateMapMarkdown(
  map: LearningMap,
  progressList: NodeProgress[],
  lessons: Lesson[]
): string {
  const total = countLearningNodes(map.root);
  const doneCount = progressList.filter((p) => p.status === 'done').length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const progressStatusMap = new Map<string, string>();
  for (const p of progressList) {
    progressStatusMap.set(p.nodeId, p.status);
  }

  const lessonMap = new Map<string, Lesson>();
  for (const l of lessons) {
    lessonMap.set(l.nodeId, l);
  }

  const dateStr = new Date(map.createdAt).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const lines: string[] = [
    `# ${map.title}`,
    '',
    `> ${map.summary}`,
    `> 建立於 ${dateStr} ｜ 完成度 ${doneCount}/${total}（${percent}%）`,
    `> 由 MapCraft 產生（AI 生成內容，請自行查證）`,
    '',
  ];

  function renderNodes(nodes: MapNode[], indentLevel = 0) {
    for (const node of nodes) {
      const isDone = progressStatusMap.get(node.id) === 'done';
      const checkMark = isDone ? '[x]' : '[ ]';
      const indent = '  '.repeat(indentLevel);
      const displayId = node.id.includes('.') ? node.id : `${node.id}.`;

      lines.push(`${indent}- ${checkMark} **${displayId} ${node.label}** — ${node.summary}`);

      const lesson = lessonMap.get(node.id);
      if (lesson) {
        const { content } = lesson;
        if (content.markdown) {
          const indentedMd = content.markdown
            .split('\n')
            .map((line) => `${indent}  > ${line}`)
            .join('\n');
          lines.push(indentedMd);
        } else {
          if (content.keyPoints && content.keyPoints.length > 0) {
            lines.push(`${indent}  - 重點：${content.keyPoints.join(' ｜ ')}`);
          }
          if (content.pitfalls && content.pitfalls.length > 0) {
            lines.push(`${indent}  - 常見誤解：${content.pitfalls.join(' ｜ ')}`);
          }
        }
      }

      if (node.children && node.children.length > 0) {
        renderNodes(node.children, indentLevel + 1);
      }
    }
  }

  if (map.root.children && map.root.children.length > 0) {
    renderNodes(map.root.children, 0);
  }

  return lines.join('\n');
}
