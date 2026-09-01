// 悬浮工具栏（极简浅米黄）：品牌 + 图谱选择 + 缩放 + 力导向 + 维度筛选。
// view 经 viewRef 间接持有；图谱切换后 swap({ view, meta, currentGraphId }) 换绑，
// 缩放 / 力导向 / 维度筛选始终作用于当前视图，无需重建工具栏。
import { createGraphSelect } from "./GraphSelect.js";
import { createDimFilter } from "./DimFilter.jsx";

export function createToolbar({ graphs, onGraphChange }) {
  const viewRef = { current: null };
  const el = document.createElement("div");
  el.className = "kg-toolbar";

  const brand = document.createElement("span");
  brand.className = "kg-brand";
  brand.textContent = "知识图谱";

  // 图谱选择：本人图谱下拉，切换即重载
  const graphSel = createGraphSelect({ graphs, onChange: onGraphChange });

  // 缩放控制
  const zoomWrap = document.createElement("div");
  zoomWrap.className = "kg-group";
  const zooms = [
    ["＋", () => viewRef.current?.zoomBy(1.5), "放大"],
    ["－", () => viewRef.current?.zoomBy(1 / 1.5), "缩小"],
    ["⤢", () => viewRef.current?.fit(), "适配视图"],
  ];
  for (const [text, fn, title] of zooms) {
    const b = document.createElement("button");
    b.className = "kg-btn";
    b.type = "button";
    b.title = title;
    b.textContent = text;
    b.addEventListener("click", fn);
    zoomWrap.append(b);
  }

  // 布局切换：确定性网格（默认） ↔ d3-force 力导向
  const forceWrap = document.createElement("div");
  forceWrap.className = "kg-group";
  const forceBtn = document.createElement("button");
  forceBtn.className = "kg-btn";
  forceBtn.type = "button";
  forceBtn.title = "切换 d3-force 力导向布局（默认关闭：确定性网格布局）";
  forceBtn.textContent = "力导向";
  forceBtn.addEventListener("click", () => {
    const v = viewRef.current;
    if (!v) return;
    const next = !v.isForceOn();
    v.setForceLayout(next);
    forceBtn.classList.toggle("on", next);
  });
  forceWrap.append(forceBtn);

  // 维度筛选（graph.dims 驱动，替代原层级筛选）
  const dimFilter = createDimFilter({
    dims: [],
    onChange: (dimKey, valueCode, next) => viewRef.current?.setDimState(dimKey, valueCode, next),
  });

  el.append(brand, graphSel.el, zoomWrap, forceWrap, dimFilter.el);

  // 初始/换图后按当前视图的力导向状态同步按钮点亮（维度筛选不再影响力导向开关）
  function setForceOn(on) {
    forceBtn.classList.toggle("on", Boolean(on));
  }

  // 图谱切换后：换绑当前视图、更新下拉选中值与维度面板
  function swap({ view, meta, currentGraphId }) {
    viewRef.current = view;
    graphSel.setValue(currentGraphId);
    dimFilter.setDims(meta.dims || []);
    setForceOn(view?.isForceOn());
  }

  return { el, swap, setForceOn };
}
