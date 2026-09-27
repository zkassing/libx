/**
 * 新节点落位：以画布可视区中心为基准的两列网格，避免节点互相压住。
 * AI 助手面板是浮层（与 LibTV 一致），节点允许落在它后面。
 */
export function nextNodePosition(
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number },
  index: number,
) {
  const center = screenToFlowPosition({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: Math.round(center.x - 470 + col * 520),
    y: Math.round(center.y - 170 + row * 430),
  };
}
