// d3-force 力导向布局：与确定性网格布局可切换的备选布局。
// 开启时跑 force simulation，实时把坐标写回 graphology 图并触发重绘；
// stage 由 forceX 牵引到原确定性布局的列中心，保持「需求/设计」分列语义，虚竖线仍可绘制。
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

const LINK_DIST = 240;  // 关系期望长度（图形单位，≥ 卡宽量级）
const CHARGE = -500;    // 斥力（比首版弱：初始化不再暴冲）
const X_STRENGTH = 0.08; // stage 列牵引强度（保持分列）
const Y_STRENGTH = 0.04; // 纵向收拢强度（弱）
const COLLIDE_R = 110;  // 碰撞半径（最小间距 ~2×）
const VELOCITY_DECAY = 0.75; // 速度衰减（摩擦）。d3 内部存 1-值：0.75 → 每帧只保留 25% 速度，阻尼大、尽快停止
const START_ALPHA = 0.55;    // 起始 alpha 调低：力按比例衰减，首几帧不猛弹
const ALPHA_DECAY = 0.06;    // alpha 冷却更快：~1.8s 内收敛停止（配合高阻尼，仿真尽快停下）

export function createForceLayout({ graph, sigma, layout, onTick, onEnd }) {
  let sim = null;
  let running = false;

  function stageCenterX(stage) {
    const r = layout.stageRanges?.[stage];
    return r ? (r.minX + r.maxX) / 2 : 0;
  }

  // 从当前图重建仿真节点/关系集合（维度剔除时只让可见节点参与受力）
  function buildSim(nodes, links) {
    return forceSimulation(nodes)
      .force("link", forceLink(links).id((d) => d.id).distance(LINK_DIST).strength(0.3))
      .force("charge", forceManyBody().strength(CHARGE))
      .force("x", forceX((d) => stageCenterX(d.stage)).strength(X_STRENGTH))
      .force("y", forceY(0).strength(Y_STRENGTH))
      .force("collide", forceCollide(COLLIDE_R))
      .velocityDecay(VELOCITY_DECAY)
      .alphaDecay(ALPHA_DECAY)
      .alpha(START_ALPHA)
      .on("tick", () => {
        for (const n of sim.nodes()) {
          graph.setNodeAttribute(n.id, "x", n.x);
          graph.setNodeAttribute(n.id, "y", n.y);
        }
        if (onTick) onTick();
      })
      .on("end", () => {
        if (onEnd) onEnd();
      });
  }

  function collect(ids) {
    const idSet = ids ? new Set(ids) : null;
    const nodes = [];
    graph.forEachNode((id, attrs) => {
      if (!idSet || idSet.has(id)) nodes.push({ id, stage: attrs.stage, x: attrs.x, y: attrs.y });
    });
    const links = [];
    graph.forEachEdge((_id, _attrs, source, target) => {
      if (!idSet || (idSet.has(source) && idSet.has(target))) links.push({ source, target });
    });
    return { nodes, links };
  }

  function start() {
    if (running) return;
    running = true;
    const { nodes, links } = collect();
    sim = buildSim(nodes, links);
  }

  // 维度筛选剔除/恢复后，让仿真只对可见节点继续受力（不重启整体重排）
  function setVisible(ids) {
    if (!running || !sim) return;
    const { nodes, links } = collect(ids);
    sim.nodes(nodes);
    sim.force("link").links(links);
    sim.alpha(0.3).restart();
  }

  // 节点拖拽：返回仿真中被拖节点的对象，调用方用 fx/fy 固定它（实时力响应不暂停仿真）。
  // 仿真自然停止（alpha 耗尽）后 nodes() 仍保留，仍可查询并 wake() 重新激活。
  function getSimNode(id) {
    if (!sim) return null;
    const list = sim.nodes();
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // 拖动期间 / 结束后保持仿真运行（邻居持续受力并尽快收敛停止）
  function wake() {
    if (sim && running) sim.alpha(0.3).restart();
  }

  function stop() {
    if (sim) {
      sim.stop();
      sim = null;
    }
    running = false;
  }

  return { start, stop, setVisible, getSimNode, wake, isRunning: () => running };
}
