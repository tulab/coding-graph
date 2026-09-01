// 图谱选择下拉：列出当前用户（本人）的图谱，切换即重载视图。
// 列表来自 GET /graph（后端按 X-Identity 身份过滤，天然只含本人图谱）。
export function createGraphSelect({ graphs, current, onChange }) {
  const wrap = document.createElement("label");
  wrap.className = "kg-graphselect";

  const label = document.createElement("span");
  label.className = "kg-graphselect-label";
  label.textContent = "我的图谱";

  const sel = document.createElement("select");
  sel.className = "kg-select";
  for (const g of graphs) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name || g.id;
    sel.append(opt);
  }
  sel.value = current ?? graphs[0]?.id ?? "";
  sel.addEventListener("change", () => onChange(sel.value));

  wrap.append(label, sel);
  return { el: wrap, getValue: () => sel.value, setValue: (id) => { sel.value = id; } };
}
