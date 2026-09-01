import "./style.css";
import { api } from "./api/graph.js";
import { currentUser } from "./core/api.js";
import { computeLayout } from "./graph/layout.js";
import { createSigmaView } from "./graph/sigmaEngine.js";
import { createToolbar } from "./components/Toolbar.js";
import { createLegend } from "./components/Legend.js";

const app = document.getElementById("app");
const container = document.createElement("div");
container.id = "kg-canvas";
app.append(container);

let currentView = null;
let legendEl = null;
let toolbarRef = null; // 工具栏按钮态（力导向开关始终由按钮自身维护，维度筛选不影响它）

// 加载并渲染指定图谱（切换图谱时重建视图；工具栏常驻，经 swap 换绑）
async function renderGraph(gid) {
  if (currentView) {
    currentView.destroy();
    currentView = null;
  }
  if (legendEl) {
    legendEl.remove();
    legendEl = null;
  }

  const [graphMeta, types, objRes, linkRes] = await Promise.all([
    api.graph(gid),
    api.types(gid),
    api.objects(gid),
    api.links(gid),
  ]);

  // 维度字典经接口下发（graph.dims 声明各维度取值及显示名），枚举不写死。
  // 图谱未声明该维度时回落：从类型 / 实例数据推导取值码（显示名即码）。
  const dimDefs = Object.fromEntries((graphMeta.dims || []).map((d) => [d.key, d]));
  function dimValues(key, fallbackCodes) {
    const values = dimDefs[key]?.values;
    if (values?.length) return values.map((v) => ({ code: v.code, name: v.label }));
    return (fallbackCodes || []).map((code) => ({ code, name: code }));
  }

  // 展示层扁平化：服务端按 dim / property 返回，这里投影为 level / stage / props，
  // 并保留完整 dims 供通用维度筛选（布局仍按 level / stage 分组）。
  const nodes = objRes.items.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content || "",
    type: n.type,
    level: n.dim?.level,
    stage: n.dim?.stage,
    dims: n.dim || {},
    props: n.property || {},
  }));
  const links = linkRes.items.map((l) => ({ id: l.id, type: l.type, source: l.source, target: l.target }));

  const levels = dimValues("level", [...new Set(types.object.map((t) => t.dim?.level).filter(Boolean))]);
  const stages = dimValues("stage", [...new Set(nodes.map((n) => n.stage).filter(Boolean))]);
  const meta = {
    dims: graphMeta.dims || [], // 完整维度字典：驱动通用维度筛选
    levels,
    stages,
    level_label: dimDefs.level?.label || "层级",
    stage_label: dimDefs.stage?.label || "阶段",
    object_types: types.object.map((t) => ({ code: t.type, name: t.name, level: t.dim?.level })),
    link_types: types.link.map((t) => ({ code: t.type, name: t.name })),
  };

  const graphData = { nodes, links };
  const layout = computeLayout(graphData, stages.map((s) => s.code), levels.map((s) => s.code));
  const view = createSigmaView({
    graphData, meta, layout, container,
    onForceChange: (on) => toolbarRef?.setForceOn(on),
  });
  view.fit();
  currentView = view;
  window.__view = view; // TEMP debug hook

  const legend = createLegend({ objectTypes: meta.object_types, levels: meta.levels });
  legendEl = legend.el;
  app.append(legendEl);

  return { view, meta };
}

async function boot() {
  const graphsRes = await api.listGraphs();
  // 本人图谱：后端已按 X-Identity 过滤（/graph/list），这里按 owner_user_id 再做一次护栏。
  // 返回当前用户全部图谱（无工作图谱标记），默认选最近更新的（正在构建的），下拉同步排序。
  const graphs = (graphsRes.items || [])
    .filter((g) => !g.owner_user_id || g.owner_user_id === currentUser.user_id)
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  if (!graphs.length) throw new Error("暂无图谱：请先由应用层通过接口构建图谱与数据");

  const toolbar = createToolbar({
    graphs,
    onGraphChange: (gid) => load(gid),
  });
  toolbarRef = toolbar;
  app.append(toolbar.el);

  async function load(gid) {
    const { view, meta } = await renderGraph(gid);
    toolbar.swap({ view, meta, currentGraphId: gid });
  }
  await load(graphs[0].id);
}

boot().catch((e) => {
  console.error(e);
  container.innerHTML = `<div class="kg-error">图谱加载失败：${e.message}</div>`;
});
