// 悬停属性浮层：显示节点全部字段（含 props 扩展渠道）。
let el = null;

export function tooltipEl() {
  if (!el) {
    el = document.createElement("div");
    el.className = "kg-tooltip";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return el;
}

const FONT = '-apple-system,"Segoe UI","Microsoft YaHei",sans-serif';

function row(label, value) {
  return `<div class="kg-t-row"><span class="kg-t-k">${label}</span><span class="kg-t-v">${esc(value)}</span></div>`;
}

function esc(v) {
  return String(v == null ? "" : v)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function showTooltip(sigma, nodeId, attrs, meta) {
  const levelName = meta.levels.find((l) => l.code === attrs.level)?.name || attrs.level;
  const stageName = meta.stages.find((s) => s.code === attrs.stage)?.name || attrs.stage;
  const typeName = attrs.tname || attrs.ntype || attrs.type;
  const parts = [
    row("类型", `${typeName}`),
    row(meta.level_label || "层级", levelName),
    row(meta.stage_label || "阶段", stageName),
    row("标题", attrs.title),
  ];
  if (attrs.content) parts.push(row("内容", attrs.content));
  if (attrs.props && Object.keys(attrs.props).length) {
    for (const [k, v] of Object.entries(attrs.props)) parts.push(row(`属性 · ${k}`, v));
  }
  parts.push(row("ID", nodeId));

  const tip = tooltipEl();
  tip.innerHTML = parts.join("");
  tip.style.display = "block";

  const vp = sigma.graphToViewport(attrs);
  const rw = tip.offsetWidth, rh = tip.offsetHeight;
  let x = vp.x + 16, y = vp.y + 14;
  if (x + rw > window.innerWidth - 12) x = vp.x - rw - 12;
  if (y + rh > window.innerHeight - 12) y = vp.y - rh - 12;
  tip.style.left = `${Math.max(6, x)}px`;
  tip.style.top = `${Math.max(6, y)}px`;
}

export function hideTooltip() {
  if (el) el.style.display = "none";
}
