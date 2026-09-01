// 多尺度系统：不是简单缩放，而是节点样式随尺度切换（A.3）。
// ratio 越小越放大。卡片临界不是固定阈值：由当前布局实测"卡片恰好不重叠"的动态值决定
// （sigmaEngine 每次布局变化后 setCardMaxRatio 更新）；标题态临界固定便于调参。
let cardMaxRatio = 0.6;     // 进入卡片态的临界（动态更新）
const TITLE_MAX_RATIO = 1.6; // 圆点+标题态的上界（再缩小退化为纯圆点）

export function setCardMaxRatio(r) {
  cardMaxRatio = Number.isFinite(r) ? r : 0.6;
}
export function getCardMaxRatio() {
  return cardMaxRatio;
}

export function scaleFromRatio(ratio) {
  if (ratio <= cardMaxRatio) return 1;   // 放大到位：矩形卡片
  if (ratio <= TITLE_MAX_RATIO) return 2; // 圆 + title
  return 3;                                // 退化为圆点
}

// 聚合预留：未来在 scale-3 对密集的同 stage/level 节点聚合成聚合点。
// 返回 null 表示不做聚合；接入聚合时返回 { id, x, y, count, level, stage, children }。
export function maybeAggregate(_scale, _stageGroup) {
  return null;
}
