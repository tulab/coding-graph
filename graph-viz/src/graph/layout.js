// 无物理布局：按 stage 分组，组内按 level 顺序自左向右排块（A.5）。
// level 顺序由接口下发的维度字典决定（不写死层级语义）；未声明时按数据中出现顺序。
// 返回各节点坐标、stage 分界虚竖线 x、整体 y 范围。
export const CELL = { w: 340, h: 190 }; // 网格单元（图形单位，ratio=1 时≈像素）
const BLOCK_GAP = 260;                  // 同 stage 内相邻 level 块间距（≥ 卡片宽，保证浅缩放即可看卡）
const STAGE_GAP = 360;                  // 相邻 stage 间距（分界虚竖线所在）
const TOP = 160;                        // 首行 y
const PAD = 90;                         // 整体左边距

function byTitle(a, b) {
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

function layBlock(list, originX, positions) {
  if (!list.length) return originX;
  const cols = Math.ceil(Math.sqrt(list.length));
  list.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[n.id] = {
      x: originX + col * CELL.w + CELL.w / 2,
      y: TOP + row * CELL.h + CELL.h / 2,
    };
  });
  return originX + (cols - 1) * CELL.w + CELL.w; // 块右边缘
}

export function computeLayout(graphData, stageOrder, levelOrder = []) {
  const byStage = {};
  for (const n of graphData.nodes) (byStage[n.stage] ||= []).push(n);
  if (!levelOrder.length) {
    levelOrder = [...new Set(graphData.nodes.map((n) => n.level).filter(Boolean))];
  }

  const positions = {};
  const stageRanges = {};
  const dividers = [];
  let cursorX = PAD;
  let prevStage = null;
  let graphMinY = Infinity;
  let graphMaxY = -Infinity;

  for (const st of stageOrder) {
    const nodes = byStage[st];
    if (!nodes) continue;
    const x0 = cursorX;
    let blockRight = x0;
    for (const lv of levelOrder) {
      const list = nodes.filter((n) => n.level === lv).sort(byTitle);
      if (!list.length) continue;
      blockRight = layBlock(list, blockRight + (blockRight > x0 ? BLOCK_GAP : 0), positions);
    }
    const blockMaxX = blockRight;
    let sy0 = Infinity, sy1 = -Infinity;
    for (const n of nodes) {
      const p = positions[n.id];
      sy0 = Math.min(sy0, p.y);
      sy1 = Math.max(sy1, p.y);
    }
    graphMinY = Math.min(graphMinY, sy0);
    graphMaxY = Math.max(graphMaxY, sy1);
    stageRanges[st] = { minX: x0, maxX: blockMaxX, minY: sy0, maxY: sy1 };
    if (prevStage) dividers.push({ x: (stageRanges[prevStage].maxX + x0) / 2, stage: st });
    cursorX = blockMaxX + STAGE_GAP;
    prevStage = st;
  }
  return { positions, dividers, stageRanges, yExtent: [graphMinY - 90, graphMaxY + 90] };
}
