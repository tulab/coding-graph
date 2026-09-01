// graph 读端点（前端只读，走四层接口读端点；统一 POST + body，无 query 参数）。
// 对应后端 graph 包（app/graph/）四层接口；查询/列表统一走 .../list（ids 空=全部、非空=指定）。
import { post } from "../core/api.js";

export const api = {
  // ids 空 = 当前用户全部图谱
  listGraphs: () => post("/graph/list", {}),
  // 单图元数据：走 /graph/list 取 items[0]
  graph: async (graphId) => {
    const res = await post("/graph/list", { ids: [graphId] });
    const g = res.items?.[0];
    if (!g) throw new Error(`图谱不存在或无权访问: ${graphId}`);
    return g;
  },
  types: (graphId) => post("/schema/types", { graph_id: graphId }),
  // 节点查询 limit 显式传上限 100（接口约定：limit 默认 20、上限 100，不传只能拿到前 20）
  objects: (graphId) => post("/instance/object/list", { graph_id: graphId, limit: 100 }),
  links: (graphId) => post("/instance/link/list", { graph_id: graphId }),
};
