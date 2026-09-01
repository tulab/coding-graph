// sigma 图谱视图：建图、多尺度本体尺寸动画、维度三态 reducer、动态卡片阈值、stage 虚竖线、悬停浮层、节点拖拽。
// 维度筛选三态行为：
//   hidden → 节点剔除（力导向关：重排可见节点不留空位；力导向开：仅退出仿真、开关不受影响），关联边一并隐藏；
//   semi   → 节点保留，自身 alpha 淡化（WebGL 圆点用预乘色、标签层用 globalAlpha）；
//   visible→ 完整显示。
// 卡片态（scale-1）：reducer 把本体圆点色置全透明（不绘制），拾取 id 独立于颜色 → 悬停/点击仍命中；
// 卡片由标签层用 baseColor 绘制，圆点与卡片只显其一。
import Sigma from "sigma";
import Graph from "graphology";

import { nodeColor, fadeWebGL, withAlpha, EDGE_COLOR } from "../config/palette.js";
import { scaleFromRatio, setCardMaxRatio } from "../config/scale.js";
import { computeLayout } from "./layout.js";
import { drawLevelNode, drawEdgeLabel, drawNodeHover, setSigma, bodySizeForScale, SEMI_ALPHA, CARD_PICK_SIZE, CARD as CARD_DIMS } from "./nodeProgram.js";
import { showTooltip, hideTooltip } from "./tooltip.js";
import { createForceLayout } from "./forceLayout.js";

const SIZE_TWEEN_MS = 260; // scale 切换时本体尺寸动画时长

export function createSigmaView({ graphData, meta, layout, container, onForceChange }) {
  const typeName = Object.fromEntries((meta.object_types || []).map((t) => [t.code, t.name]));
  const linkTypeName = Object.fromEntries((meta.link_types || []).map((t) => [t.code, t.name]));
  const stageOrder = meta.stages.map((s) => s.code);
  const levelOrder = meta.levels.map((s) => s.code);
  // 维度三态初始全部"显示"；维度集合来自接口下发的维度字典（graph.dims），不硬编码层级
  const dimStates = {};
  for (const dim of meta.dims || []) {
    dimStates[dim.key] = Object.fromEntries((dim.values || []).map((v) => [v.code, "visible"]));
  }

  // ---------------------------------------------------------------- 建图
  const graph = new Graph();
  for (const n of graphData.nodes) {
    const baseColor = nodeColor(n.type, n.level);
    graph.addNode(n.id, {
      x: layout.positions[n.id].x,
      y: layout.positions[n.id].y,
      size: bodySizeForScale(2),
      label: n.title,
      color: baseColor,
      baseColor, // 卡片态 reducer 会把 color 置全透明，标签层高亮/卡片描边用这个原色
      forceLabel: true,
      ntype: n.type,
      tname: typeName[n.type] || n.type,
      level: n.level,
      stage: n.stage,
      dims: n.dims || {}, // 完整 dim 取值，维度筛选按此计算
      title: n.title,
      content: n.content,
      props: n.props || {},
    });
  }
  for (const l of graphData.links) {
    if (!graph.hasNode(l.source) || !graph.hasNode(l.target)) continue;
    const name = linkTypeName[l.type] || l.type;
    // type "arrow"：sigma 自带方向箭头（EdgeArrowProgram）；forceLabel 让边标签常绘制。
    // lcolor：标签层线段色（非预乘）；卡片态 WebGL 边体透明后，线段/箭头由标签层按卡片矩形截断绘制。
    graph.addEdgeWithKey(l.id, l.source, l.target, {
      type: "arrow",
      color: EDGE_COLOR,
      lcolor: EDGE_COLOR,
      size: 2,
      label: name,
      tname: name,
      forceLabel: true,
    });
  }

  // ---------------------------------------------------------------- 维度筛选 reducer（三态）
  // 任一命中的维度取值为 hidden → 隐藏；任一为 semi 且无 hidden → 自身 alpha 淡化。
  function computeHidden(data) {
    let hidden = false, semi = false;
    for (const [key, code] of Object.entries(data.dims || {})) {
      const st = dimStates[key]?.[code];
      if (st === "hidden") hidden = true;
      else if (st === "semi") semi = true;
    }
    return { hidden, semi };
  }

  // currentScale 在 new Sigma 之前声明，reducer 构造期首刷即可读到（card 分支才用）。
  let currentScale = 2;
  function reducer(node, data) {
    const s = computeHidden(data);
    if (s.hidden) return { ...data, hidden: true };
    const card = currentScale === 1;
    if (!s.semi && !card) return data;
    const out = { ...data };
    if (card) {
      // 卡片态：WebGL 本体圆点置全透明。sigma 可见色与拾取 id 是同一顶点缓冲里
      // 的独立字段（fragment 按 PICKING_MODE 取 a_id），圆点不画但拾取/悬停仍命中；
      // size 改为卡片拾取半径（本体可见尺寸不动，无边界闪动）。卡片由标签层
      // drawCard 用 baseColor 绘制，二者只显其一。
      out.color = "#00000000";
      out.size = CARD_PICK_SIZE;
    }
    if (s.semi) {
      // 半透明 = 节点自身 alpha 修改：圆点用预乘色（sigma WebGL 预乘混合），
      // alpha 字段供标签层 globalAlpha 同步淡化标题/卡片。
      out.alpha = SEMI_ALPHA;
      if (!card) out.color = fadeWebGL(data.color, SEMI_ALPHA);
    }
    return out;
  }

  // ---------------------------------------------------------------- sigma
  const sigma = new Sigma(graph, container, {
    renderLabels: true,
    renderEdgeLabels: true,
    minCameraRatio: 0.06,
    maxCameraRatio: 6,
    enableCameraZooming: true, // 滚轮缩放（sigma 默认开启，显式声明）
    enableCameraPanning: true,
    labelRenderedSizeThreshold: 1,   // 恒绘制（forceLabel 兜底）
    nodeReducer: reducer,
    defaultDrawNodeLabel: drawLevelNode,
    defaultDrawNodeHover: drawNodeHover, // 主题化高亮：节点色描边环（替代 sigma 默认白胶囊）
    defaultDrawEdgeLabel: drawEdgeLabel, // 边类型名小字（方向由 arrow 边本体表达）
    defaultNodeColor: "#9aa0a6",
    defaultEdgeColor: EDGE_COLOR,
    edgeLabelSize: 10, // 边标签小字号
  });
  setSigma(sigma);
  const dividers = createStageDividers(container, sigma, graph, stageOrder, (id) => isNodeHidden(id));
  dividers.update();

  // ---------------------------------------------------------------- 多尺度：scale 切换 → 本体尺寸平滑动画
  let currentSize = bodySizeForScale(2);
  let tweenToken = 0;
  function tweenSize(to) {
    const from = currentSize;
    const token = ++tweenToken;
    const t0 = performance.now();
    function frame(now) {
      if (token !== tweenToken) return; // 被更新的 tween 取代
      const p = Math.min(1, (now - t0) / SIZE_TWEEN_MS);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      currentSize = from + (to - from) * e;
      graph.forEachNode((id) => graph.setNodeAttribute(id, "size", currentSize));
      sigma.refresh();
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  // 注意：sigma 3 的相机事件叫 "updated"（不是 "cameraUpdated"），
  // 直接监听 sigma 实例上的 cameraUpdated 不会触发。
  sigma.getCamera().on("updated", () => {
    const scale = scaleFromRatio(sigma.getCamera().ratio);
    if (scale !== currentScale) {
      const prevCard = currentScale === 1;
      currentScale = scale;
      tweenSize(bodySizeForScale(scale));
      if (prevCard !== (scale === 1)) {
        // 卡片态进出：WebGL 边体透明/恢复。卡片态边改由标签层按卡片矩形截断绘制
        // （WebGL 箭头停在圆形边界，垂直方向会超出卡片上下缘 → 残留箭头）。
        applyEdgeColors();
        sigma.refresh();
      }
    }
  });

  // ---------------------------------------------------------------- 悬停浮层
  sigma.on("enterNode", ({ node }) => {
    showTooltip(sigma, node, graph.getNodeAttributes(node), meta);
  });
  sigma.on("leaveNode", hideTooltip);
  sigma.on("moveNode", hideTooltip);
  sigma.on("clickStage", hideTooltip);
  sigma.getCamera().on("updated", hideTooltip);

  // ---------------------------------------------------------------- 视图度量 / 适配
  // 某节点当前是否被维度筛选隐藏（fit / 卡片阈值 / stage 分割线均按此排除）
  function isNodeHidden(nodeId) {
    return computeHidden(graph.getNodeAttributes(nodeId)).hidden;
  }

  // 卡片临界：放大到"卡片恰好不重叠"时进入卡片态（item 4）。
  // 用 graphToViewport 在 ratio=1 参考系测全部可见节点对的投影距离，
  // 求使任一卡不重叠所需的最大 ratio；再夹在适配 ratio 之下，保证初始概览落在圆点态。
  function computeCardThreshold() {
    const fit = fitMetrics(sigma, isNodeHidden);
    if (!fit) {
      setCardMaxRatio(0.6);
      return;
    }
    const prev = sigma.getCamera().getState();
    sigma.getCamera().setState({ x: fit.x, y: fit.y, ratio: 1 });
    const pts = [];
    graph.forEachNode((id, attrs) => {
      if (isNodeHidden(id)) return;
      const p = sigma.graphToViewport(attrs);
      pts.push({ x: p.x, y: p.y });
    });
    sigma.getCamera().setState(prev);
    const { w: cw, h: ch } = CARD_DIMS;
    const GW = cw + 24, GH = ch + 24; // 卡片尺寸 + ~12px 间隙，避免恰好相切
    // 屏幕距(r) = 参考距 / r（r 越小越放大、节点间距越大）。
    // 卡片不重叠 ⟺ dx/r >= GW 或 dy/r >= GH ⟺ r <= dx/GW 或 r <= dy/GH
    // ⟺ 逐对允许的最大 ratio = max(dx/GW, dy/GH)（dy=0 只算横向，dx=0 只算纵向）。
    // 全局取最小：ratio 低于它时所有卡片都不重叠。
    let need = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = Math.abs(pts[i].x - pts[j].x);
        const dy = Math.abs(pts[i].y - pts[j].y);
        if (dx < 1e-9 && dy < 1e-9) continue;
        const per = dy < 1e-9 ? dx / GW : dx < 1e-9 ? dy / GH : Math.max(dx / GW, dy / GH);
        if (per < need) need = per;
      }
    }
    if (!Number.isFinite(need)) need = 1e-6;
    setCardMaxRatio(Math.max(Math.min(need, fit.ratio * 0.9), 0.25));
  }

  // 布局变化（建图 / 力导向收敛 / 维度剔除）后重算卡片阈值并适配
  function recalcView() {
    computeCardThreshold();
    fit();
  }

  // ---------------------------------------------------------------- 维度筛选：剔除 / 淡化落库
  // hidden 时：力导向开着 → 只让隐藏节点退出仿真（开关与运行不受影响）；
  //          力导向关 → 仅可见节点重排（剔除不留空位）。关联边隐藏；semi 淡化边。
  let lastHidden = new Set(); // 上一次剔除后的隐藏集（用于判断布局是否变化、是否需要重适配）
  function recompute() {
    const hidden = new Set();
    graph.forEachNode((id, attrs) => {
      if (computeHidden(attrs).hidden) hidden.add(id);
    });
    const layoutChanged = !sameSet(hidden, lastHidden);
    lastHidden = hidden;
    const visibleNodes = graphData.nodes.filter((n) => !hidden.has(n.id));
    const visibleIds = visibleNodes.map((n) => n.id);
    // 确定性布局永远按"当前可见集"重算并存下（供切回网格 / 力导向关闭时恢复）
    const newLayout = computeLayout({ nodes: visibleNodes }, stageOrder, levelOrder);
    layout.positions = newLayout.positions;
    layout.stageRanges = newLayout.stageRanges;
    layout.dividers = newLayout.dividers;
    layout.yExtent = newLayout.yExtent;

    if (forceOn) {
      // 力导向开着：切换维度不影响它的开关与运行，只让隐藏节点退出仿真、
      // 可见节点继续受力（不重排坐标、不拉相机）
      force.setVisible(visibleIds);
    } else {
      // 力导向关（确定性网格）：隐藏节点剔除 → 仅可见节点重排，不留空位；
      // 隐藏节点保持原位（由 reducer 隐藏，坐标无意义；避免后续开力导向时在原点扎堆）
      graph.updateEachNodeAttributes((id, attrs) => {
        if (hidden.has(id)) return attrs;
        const p = newLayout.positions[id];
        return { ...attrs, x: p ? p.x : 0, y: p ? p.y : 0 };
      });
    }
    applyEdgeColors();

    dividers.update();
    computeCardThreshold();
    if (layoutChanged && !forceOn) {
      fit(); // 剔除后整图收缩，重适配
    }
    sigma.refresh();
  }
  function sameSet(a, b) {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  // 边显示属性：hidden（端点隐藏）/ lcolor（标签层线段色，非预乘）/ color（WebGL 边体色）。
  // 卡片态把 WebGL 边体置全透明：其箭头会停在 CARD_PICK_SIZE 圆边界（垂直方向超出卡片上下缘），
  // 线段与箭头改由标签层 drawEdgeLabel 按卡片矩形截断绘制、指向卡片边缘。
  // 半透明态边淡出：WebGL 用预乘色、标签层用非预乘 rgba。
  function applyEdgeColors() {
    const card = currentScale === 1;
    graph.updateEachEdgeAttributes((edge, attrs) => {
      const [s, t] = graph.extremities(edge);
      const sAttrs = graph.getNodeAttributes(s), tAttrs = graph.getNodeAttributes(t);
      const sh = computeHidden(sAttrs).hidden, th = computeHidden(tAttrs).hidden;
      if (sh || th) return { ...attrs, hidden: true };
      const semi = computeHidden(sAttrs).semi || computeHidden(tAttrs).semi;
      return {
        ...attrs,
        hidden: false,
        lcolor: semi ? withAlpha(EDGE_COLOR, 0.35) : EDGE_COLOR,
        color: card ? "#00000000" : semi ? fadeWebGL(EDGE_COLOR, 0.35) : EDGE_COLOR,
      };
    });
  }

  // ---------------------------------------------------------------- 对外
  function setDimState(dimKey, valueCode, state) {
    dimStates[dimKey] ||= {};
    dimStates[dimKey][valueCode] = state;
    recompute();
  }
  function getDimState(dimKey, valueCode) {
    return dimStates[dimKey]?.[valueCode];
  }
  function zoomBy(factor) {
    userZoomed = true;
    sigma.getCamera().animatedZoom({ factor, duration: 240 });
  }
  function fit() {
    fitView(sigma, isNodeHidden);
  }

  // ---------------------------------------------------------------- 手动缩放标记
  // 用户主动放大/缩小（滚轮 / 缩放按钮 / 双击）后，力导向收敛不再自动重算卡片临界或拉相机：
  // 保证"放大→缩小"一次循环穿越同一个卡片阈值（进出对称），且不打断用户正在看的局部。
  let userZoomed = false;
  sigma.getMouseCaptor().on("wheel", () => { userZoomed = true; });
  sigma.getMouseCaptor().on("doubleClick", () => { userZoomed = true; });

  // ---------------------------------------------------------------- d3-force 力导向布局（可切换）
  // pendingFit：仅在"本次启动/重启"收敛后做整体适配；之后（拖拽后、维度剔除后）
  // 再次收敛只重算卡片临界，不把相机拉回概览（避免打断用户正在查看的局部）。
  let pendingFit = true;
  const force = createForceLayout({
    graph,
    sigma,
    layout,
    onTick: () => {
      dividers.update(); // 节点移动时虚竖线随列边界重算
      sigma.refresh();
    },
    onEnd: () => {
      if (pendingFit) {
        pendingFit = false;
        if (userZoomed) {
          // 用户已手动缩放：保持当前相机与卡片临界（不重算、不拉回）→ 进出对称
        } else {
          recalcView(); // 初始自动收敛（用户未干预）：按最终坐标重算临界并适配
        }
      } else {
        computeCardThreshold(); // 后续收敛（拖拽/维度后）：只更新临界，不拉相机
      }
    },
  });
  let forceOn = false;
  function setForceLayout(on) {
    if (on === forceOn) return;
    forceOn = on;
    if (on) {
      pendingFit = true;
      force.start();
    } else {
      force.stop();
      // 恢复确定性网格布局坐标
      graph.forEachNode((id) => {
        const p = layout.positions[id];
        if (p) {
          graph.setNodeAttribute(id, "x", p.x);
          graph.setNodeAttribute(id, "y", p.y);
        }
      });
      dividers.update();
      sigma.refresh();
      recalcView();
    }
  }

  // ---------------------------------------------------------------- 节点拖拽
  // 在节点上按下并拖动 → 移动该节点（而非平移画布）；空白处拖动仍平移。
  // sigma 3 用 WebGL picking 缓冲做命中（独立于可见色）：卡片态圆点透明但可点拖。
  let dragNodeId = null;
  let dragStart = null; // 按下时的视口坐标，用于区分"单击"与"拖拽"（>4px 才算拖）
  let dragMoved = false;
  let dragPanning = true;
  let dragSimNode = null; // 力导向仿真中被拖节点对象（用 fx/fy 固定）
  sigma.on("downNode", ({ node, event }) => {
    if (event.original?.button !== 0) return; // 仅左键拖动节点
    dragNodeId = node;
    dragStart = { x: event.x, y: event.y }; // downNode 的 event 是容器相对视口坐标
    dragMoved = false;
    dragPanning = sigma.getCamera().enabledPanning;
    sigma.getCamera().enabledPanning = false; // 拖节点时画布不平移
    // 实时力响应：按下即把被拖节点固定到当前位置（fx/fy），仿真不暂停，
    // 邻居随拖动持续受力（而非等松手才被拉回 / 被拖节点弹回原位）。
    dragSimNode = force.getSimNode(node);
    if (dragSimNode) {
      dragSimNode.fx = dragSimNode.x;
      dragSimNode.fy = dragSimNode.y;
      force.wake();
    }
  });
  function onDragMove(e) {
    if (!dragNodeId) return;
    const rect = container.getBoundingClientRect();
    const vp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!dragMoved && dragStart && Math.hypot(vp.x - dragStart.x, vp.y - dragStart.y) < 4) return;
    if (!dragMoved) {
      dragMoved = true;
      hideTooltip(); // 拖动中不显示悬停浮层
    }
    const pos = sigma.viewportToGraph(vp);
    graph.setNodeAttribute(dragNodeId, "x", pos.x);
    graph.setNodeAttribute(dragNodeId, "y", pos.y);
    if (dragSimNode) {
      dragSimNode.fx = pos.x; // 固定位置随鼠标移动（tick 会把 graph 坐标覆盖为同一值）
      dragSimNode.fy = pos.y;
      force.wake(); // 拖动期间保持仿真运行 → 邻居实时响应
    }
    dividers.update();
    sigma.refresh();
  }
  function onDragUp() {
    if (!dragNodeId) return;
    const id = dragNodeId;
    const simNode = dragSimNode;
    dragNodeId = null;
    dragStart = null;
    dragSimNode = null;
    sigma.getCamera().enabledPanning = dragPanning; // 恢复画布平移
    if (!dragMoved) {
      // 单击（未移动）：解除固定，节点回到仿真控制，不改变布局
      if (simNode) { simNode.fx = null; simNode.fy = null; }
      return;
    }
    // 记下拖放位置（力导向关闭后恢复网格时，被拖节点仍停在拖放处）
    const gx = simNode ? simNode.x : graph.getNodeAttribute(id, "x");
    const gy = simNode ? simNode.y : graph.getNodeAttribute(id, "y");
    layout.positions[id] = { x: gx, y: gy };
    // 保持 fx/fy 固定：节点停在拖放处，不再弹回拖前位置；邻居继续收敛，
    // 收敛后 onEnd → 只重算卡片临界（不拉相机）。
    if (simNode) force.wake();
    computeCardThreshold(); // 节点位置变化 → 重算卡片临界
  }
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragUp);

  // 卸载当前视图（图谱切换 / 重建时调用）：停止力导向、释放 sigma 与 SVG 覆盖层
  function destroy() {
    if (forceOn) force.stop();
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragUp);
    sigma.kill();
    container.querySelectorAll(".kg-dividers").forEach((s) => s.remove());
  }

  // 初始视图：先按确定性布局适配并定卡片临界，随即默认开启力导向；
  // 仿真收敛后 onEnd → recalcView（按力导向最终坐标重算卡片临界并适配）。
  fit();
  computeCardThreshold();
  setForceLayout(true);

  return {
    sigma, graph,
    setDimState, getDimState, isNodeHidden,
    zoomBy, fit, setForceLayout, isForceOn: () => forceOn, getScale: () => currentScale,
    destroy,
  };
}

// ---------------------------------------------------------------- stage 虚竖线（SVG 覆盖层，随相机变换）
// 分隔线位置由当前节点坐标按 stage 分组计算（确定性布局与力导向布局通用），
// 仅当左右相邻 stage 里存在可见节点时绘制；隐藏节点不参与列边界统计。
function createStageDividers(container, sigma, graph, stageOrder, isNodeHidden) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("kg-dividers");
  container.appendChild(svg);

  function stageVisible(stage) {
    let visible = false;
    graph.forEachNode((id, attrs) => {
      if (attrs.stage === stage && !isNodeHidden(id)) visible = true;
    });
    return visible;
  }

  function update() {
    const w = container.clientWidth, h = container.clientHeight;
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);

    const bounds = {}; // stage → {minX, maxX}
    let minY = Infinity, maxY = -Infinity;
    graph.forEachNode((_id, attrs) => {
      if (isNodeHidden(_id)) return;
      const b = (bounds[attrs.stage] ||= { minX: Infinity, maxX: -Infinity });
      if (attrs.x < b.minX) b.minX = attrs.x;
      if (attrs.x > b.maxX) b.maxX = attrs.x;
      if (attrs.y < minY) minY = attrs.y;
      if (attrs.y > maxY) maxY = attrs.y;
    });
    const y0 = minY - 90, y1 = maxY + 90;

    let html = "";
    let prev = null;
    for (const st of stageOrder) {
      if (!bounds[st]) continue;
      if (prev && stageVisible(st)) {
        const x = (bounds[prev].maxX + bounds[st].minX) / 2; // 相邻 stage 列边界的中心
        const p0 = sigma.graphToViewport({ x, y: y0 });
        const p1 = sigma.graphToViewport({ x, y: y1 });
        html += `<line x1="${p0.x.toFixed(1)}" y1="${p0.y.toFixed(1)}" x2="${p1.x.toFixed(1)}" y2="${p1.y.toFixed(1)}"></line>`;
      }
      prev = st;
    }
    svg.innerHTML = html;
  }
  sigma.getCamera().on("updated", update);
  return { update };
}

// ---------------------------------------------------------------- 视图适配：fit 到 scale-2（按当前可见节点坐标）
// sigma 3 的相机工作在归一化空间：节点坐标经 normalizationFunction 映射到 [0,1] 附近，
// 直接用图坐标设 camera 会把相机移到图外（节点全部投影到屏幕外、不可见）。
// 做法：图 bounds 经 normalizationFunction 求归一化中心作为相机焦点，
// 设 ratio=1 用 graphToViewport 实测投影跨度，反推 ratio 使图完整落入视口（留 6% 边距）。
// 隐藏节点不参与 bounds 与跨度（剔除后整图收缩仍能正确适配）。
export function fitMetrics(sigma, isHidden) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  sigma.getGraph().forEachNode((_id, attrs) => {
    if (isHidden && isHidden(_id)) return;
    if (attrs.x < minX) minX = attrs.x;
    if (attrs.x > maxX) maxX = attrs.x;
    if (attrs.y < minY) minY = attrs.y;
    if (attrs.y > maxY) maxY = attrs.y;
  });
  if (!Number.isFinite(minX)) return null;

  const norm = sigma.normalizationFunction;
  const p0 = norm({ x: minX, y: minY });
  const p1 = norm({ x: maxX, y: maxY });
  const cx = (p0.x + p1.x) / 2;
  const cy = (p0.y + p1.y) / 2;

  const prev = sigma.getCamera().getState();
  sigma.getCamera().setState({ x: cx, y: cy, ratio: 1 });
  const tl = sigma.graphToViewport({ x: minX, y: minY });
  const br = sigma.graphToViewport({ x: maxX, y: maxY });
  sigma.getCamera().setState(prev);

  const sw = Math.abs(br.x - tl.x);
  const sh = Math.abs(br.y - tl.y);
  const cw = sigma.getContainer().clientWidth || 1200;
  const ch = sigma.getContainer().clientHeight || 800;
  const ratio = Math.max(sw / (0.94 * cw), sh / (0.94 * ch), 1e-6);
  return { ratio, x: cx, y: cy };
}

export function fitView(sigma, isHidden) {
  const m = fitMetrics(sigma, isHidden);
  if (!m) return;
  sigma.getCamera().setState({ x: m.x, y: m.y, ratio: m.ratio });
}
