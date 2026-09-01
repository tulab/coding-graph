// 多尺度节点渲染（A.2/A.3）：作为 sigma 的 defaultDrawNodeLabel 在标签层绘制。
// 标签层坐标为屏幕像素；节点本体（WebGL 圆点）负责交互拾取。
//   scale-1 矩形卡片：type 徽标 + title + content。本体圆点由 sigmaEngine 的
//           reducer 在卡片态置全透明（不绘制），拾取 id 独立于颜色仍可点拖 ——
//           卡片与圆点只显其一，且任意缩放深度都不会有圆点从卡边冒出。
//   scale-2 圆点本体 + title
//   scale-3 退化为圆点（本体即是视觉，本层不画）
import { scaleFromRatio } from "../config/scale.js";
import { nodeColor, withAlpha, EDGE_COLOR } from "../config/palette.js";

let sigmaRef = null;
export function setSigma(sigma) {
  sigmaRef = sigma;
}

// 节点本体尺寸（WebGL 圆半径，屏幕参考系）。scale-1 本体在 reducer 里置全透明（不绘制），
// 且 BODY_SIZE[1] 与 scale-2 相同 → 卡片边界只切换颜色透明度、尺寸不动 → 无"退出卡片闪大圆点"。
// 卡片态的拾取命中半径由 reducer 单独置 CARD_PICK_SIZE：
// itemSizesReference="screen"、zoomToSizeRatioFunction=√，屏上半径≈size/√ratio，
// 40 在典型卡片浏览缩放（ratio≈0.2~0.3）下约 70~90px，整卡可点拖。
export const BODY_SIZE = { 1: 13, 2: 13, 3: 5 };
export const CARD_PICK_SIZE = 40;
export function bodySizeForScale(scale) {
  return BODY_SIZE[scale] ?? 13;
}

// 当前是否卡片态（sigmaEngine 的 reducer 用它把本体色置透明，标签层用它判断边标签/箭头）
export function isCardScale() {
  return sigmaRef ? scaleFromRatio(sigmaRef.getCamera().ratio) === 1 : false;
}

export const CARD = { w: 248, h: 128, r: 10 };
const FONT = '-apple-system,"Segoe UI","Microsoft YaHei",sans-serif';
export const SEMI_ALPHA = 0.4; // 维度筛选"半透明"态：节点自身 alpha（与 reducer 中的预乘色保持一致）

function ratio() {
  return sigmaRef ? sigmaRef.getCamera().ratio : 1;
}

export function drawLevelNode(context, data) {
  if (data.hidden) return;
  const canvas = context.canvas;
  // 离屏早退
  if (data.x < -CARD.w || data.x > canvas.width + CARD.w || data.y < -CARD.h || data.y > canvas.height + CARD.h) return;

  const scale = scaleFromRatio(ratio());
  if (scale === 1) drawCard(context, data);
  else if (scale === 2) drawTitle(context, data);
  // scale-3：本体圆点即视觉
}

// ---------------------------------------------------------------- scale-1 卡片
function drawCard(ctx, data) {
  // 卡片态 reducer 把 data.color 置为全透明（隐藏 WebGL 本体圆点），
  // 卡片本身的描边/徽标底用建图时存的原色 baseColor，避免跟着变透明。
  const color = data.baseColor || data.color || nodeColor(data.ntype, data.level);
  const x0 = data.x - CARD.w / 2;
  const y0 = data.y - CARD.h / 2;
  ctx.save();
  ctx.globalAlpha = data.alpha ?? 1; // 半透明态：整卡随节点 alpha 淡化

  ctx.shadowColor = "rgba(62,51,40,.18)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x0, y0, CARD.w, CARD.h, CARD.r);
  ctx.fillStyle = "#fbf7ee"; // 不透明填充：圆点被卡片完全盖住（卡片与圆点只显其一）
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // type 徽标（左上）：浅色节点色底 + 卡片墨色字，不再用白色标签
  const name = data.tname || data.ntype || data.type;
  ctx.font = `11px ${FONT}`;
  const tw = ctx.measureText(name).width;
  roundRect(ctx, x0 + 12, y0 + 12, tw + 18, 20, 10);
  ctx.fillStyle = withAlpha(color, 0.18);
  ctx.fill();
  ctx.fillStyle = "#3f372c";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(name, x0 + 12 + 9, y0 + 22);

  // title
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = "#3f372c";
  ctx.textBaseline = "top";
  wrapText(ctx, data.title, x0 + 14, y0 + 46, CARD.w - 28, 18, 1);

  // content（最多 3 行，超出省略）
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = "#6d6356";
  wrapText(ctx, data.content || "", x0 + 14, y0 + 68, CARD.w - 28, 16, 3);
  ctx.restore();
}

// ---------------------------------------------------------------- scale-2 标题
function drawTitle(ctx, data) {
  ctx.save();
  ctx.globalAlpha = data.alpha ?? 1; // 半透明态：标题随节点 alpha 淡化
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = "rgba(63,55,44,.92)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(data.title, data.x, data.y + data.size + 8);
  ctx.restore();
}

// ---------------------------------------------------------------- 边标签（A.4）：类型名小字 + 方向箭头
// sigma 在 renderEdgeLabels 调用，data 为边数据，source/target 为带屏幕坐标的两端节点。
// 只有边的投影足够长（能放下文字）才绘制，避免缩小时互相覆盖。
// 卡片态（scale-1）：WebGL 边体已置全透明（其箭头停在圆形边界、垂直方向超出卡片），
// 这里在标签层完整绘制线段（截断到卡片边缘）+ 类型名 + 目标端箭头，指向卡片边缘。
export function drawEdgeLabel(ctx, edgeData, sourceData, targetData) {
  const label = edgeData.tname || edgeData.label;
  if (!label || edgeData.hidden || sourceData.hidden || targetData.hidden) return;
  const card = isCardScale();

  const sx = sourceData.x, sy = sourceData.y;
  const tx = targetData.x, ty = targetData.y;
  let dx = tx - sx, dy = ty - sy;
  const d = Math.hypot(dx, dy);
  if (d < 8) return;

  let ax, ay, bx, by;
  if (card) {
    // 卡片态：截断到卡片边缘（矩形交点），线段/标签/箭头只出现在两卡之间
    const r = cardEdgeOffset(dx, dy, d);
    ax = sx + (dx / d) * r; ay = sy + (dy / d) * r;
    bx = tx - (dx / d) * r; by = ty - (dy / d) * r;
  } else {
    // 端点缩进，避免文字压在节点上
    const sOff = (sourceData.size || 0) + 8;
    const tOff = (targetData.size || 0) + 8;
    ax = sx + (dx / d) * sOff; ay = sy + (dy / d) * sOff;
    bx = tx - (dx / d) * tOff; by = ty - (dy / d) * tOff;
  }
  dx = bx - ax; dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 8) return;

  ctx.save();
  if (card) {
    // 线段：两卡之间的连接（替代被透明的 WebGL 边体，指向目标卡边缘）
    ctx.strokeStyle = edgeData.lcolor || edgeData.color || EDGE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  ctx.font = `10px ${FONT}`;
  const tw = ctx.measureText(label).width;
  if (len < tw + 26) { ctx.restore(); return; } // 边太短，省略标签与箭头

  ctx.fillStyle = "rgba(74,66,56,.72)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const midX = (ax + bx) / 2, midY = (ay + by) / 2;
  const angle = Math.atan2(dy, dx);
  ctx.translate(midX, midY);
  ctx.rotate(angle);
  ctx.fillText(label, 0, -8);

  if (card) {
    // 目标端箭头：指到卡片边缘（沿旋转后 +x）
    ctx.beginPath();
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(len / 2 - 8, -3.5);
    ctx.lineTo(len / 2 - 8, 3.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// 卡片中心到卡片边缘沿 (dx,dy) 方向的截断距离（矩形交点）
function cardEdgeOffset(dx, dy, d) {
  const hw = CARD.w / 2, hh = CARD.h / 2;
  if (Math.abs(dx) < 1e-9) return hh;
  if (Math.abs(dy) < 1e-9) return hw;
  return Math.min(hw / Math.abs(dx / d), hh / Math.abs(dy / d));
}

// ---------------------------------------------------------------- 悬停高亮（defaultDrawNodeHover）
// 替代 sigma 默认的白色胶囊：沿节点/卡片画一圈节点色描边，与配色一致、不用白色。
export function drawNodeHover(context, data) {
  if (data.hidden) return;
  // 卡片态 reducer 把 color 置透明 → 用建图时的原色 baseColor 画高亮环
  const color = data.baseColor || data.color || nodeColor(data.ntype, data.level);
  context.save();
  context.globalAlpha = data.alpha ?? 1; // 半透明态：高亮环随节点淡化
  context.strokeStyle = color;
  context.lineWidth = 2;
  if (scaleFromRatio(ratio()) === 1) {
    roundRect(context, data.x - CARD.w / 2 - 3, data.y - CARD.h / 2 - 3, CARD.w + 6, CARD.h + 6, CARD.r + 3);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(data.x, data.y, (data.size || 13) + 5, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

// ---------------------------------------------------------------- 工具
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  if (!text) return;
  const chars = [...text];
  let line = "";
  let count = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (line && ctx.measureText(test).width > maxW) {
      if (++count >= maxLines) {
        let t = line;
        while (t && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
        if (t) ctx.fillText(t + "…", x, y);
        return;
      }
      ctx.fillText(line, x, y);
      y += lineH;
      line = ch;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}
