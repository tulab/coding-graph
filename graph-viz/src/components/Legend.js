// 图例：右下角悬浮卡片，按层级（文本层/实体层）分组显示节点类型。
import { nodeColor } from "../config/palette.js";

export function createLegend({ objectTypes, levels }) {
  const el = document.createElement("div");
  el.className = "kg-legend";

  for (const lv of levels) {
    const types = objectTypes.filter((t) => t.level === lv.code);
    if (!types.length) continue;

    const group = document.createElement("div");
    group.className = "kg-legend-group";

    const title = document.createElement("div");
    title.className = "kg-legend-title";
    title.textContent = lv.name;
    group.append(title);

    const items = document.createElement("div");
    items.className = "kg-legend-items";
    for (const t of types) {
      const item = document.createElement("span");
      item.className = "kg-legend-item";
      item.innerHTML = `<i style="background:${nodeColor(t.code, t.level)}"></i>${t.name}`;
      items.append(item);
    }
    group.append(items);
    el.append(group);
  }
  return { el };
}
