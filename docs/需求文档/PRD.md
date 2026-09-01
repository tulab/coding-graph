# 需求文档 · coding-graph 智能体（PRD）

> 定位：**coding-graph 智能体**——把需求 / 设计文本构建为两层节点模型知识图谱的应用项目。
> 图谱存储与读写接口由独立的基础设施项目 **dynamic-graph**（图引擎微服务）承载，本系统只承担「智能体构建 + 图谱可视化」。
> 依据：《设计哲学/需求图谱Schema设计.md》《设计哲学/本体图谱Schema设计.md》

## 1. 背景与目标

在需求分析 / 设计阶段把语义沉淀为**可计算、可关联、可持续扩展**的知识图谱：

- **智能体**（graph-agent）读取需求 / 设计文本，按需求图谱 Schema 拆文本层 / 实体层节点并建立关系，经 dynamic-graph 写接口落库；
- **可视化**（graph-viz）只读展示图谱，供人观察与检查。

## 2. 角色与边界

| 角色 | 能力 | 渠道 |
|---|---|---|
| 用户 | 只读查看、缩放、维度筛选、切换本人图谱 | graph-viz 走 dynamic-graph 读端点 |
| coding-graph 智能体 | 读写图谱与 Schema | graph-agent 经 dynamic-graph 写接口（RPC 四层） |
| dynamic-graph | 图存储 + 四层接口 + X-Identity 身份校验 | 外部基础设施，HTTP 调用 |

## 3. 功能需求

### A. 智能体（graph-agent，node 后端）
- **A1** 内嵌 pi agent SDK（`@mariozechner/pi-coding-agent`），以 `createAgentSession` 创建会话。
- **A2** **禁用 SDK 四个基础工具**（read / bash / edit / write）：agent 不读写本地文件、不执行 shell，只做图谱构建。
- **A3** 注入**自定义工具**：图谱构建工具 = dynamic-graph 四层写接口（graph create/update、instance object/link 增删改）＋ 探查只读接口（overview / neighbours / schema/types）。
- **A4** 构建行为遵循 `skills/coding-graph/SKILL.md`（需求图谱 Schema、节点原子性、关系分层、防重复、高危删除规则）。
- **A5** 写调用携带 `X-Identity`（base64(JSON)，含 user_id / agent_id），测试阶段可写死。

### B. 可视化（graph-viz，node 前端）
- **B1** 沿用既有半成品，**只读**：走 dynamic-graph 读端点（graph 列表 / 元数据、schema/types、instance object/link）。
- **B2** 悬浮式极简工具栏，浅米黄底色。
- **B3** 节点自动布局（确定性网格为主，可切换 d3-force）；节点按类型着色；悬停显示属性。
- **B4** 多尺度：scale-1 矩形卡片（title/content/type）、scale-2 圆 + 仅 title、scale-3 退化为圆点；非简单缩放而是样式切换，**预留聚合**。
- **B5** 层级三态筛选（显示 / 半透明 / 隐藏），取值经接口下发的维度字典获得。
- **B6** 按 stage 分组布局，同 stage 节点聚拢，stage 间**虚竖线**区分（需求 / 设计）。

### C. 总体
- **C1** 最小化实现，合理封装模块 / 组件，传参简洁。
- **C2** 图谱 / 类型字典 / 实例由应用层经 dynamic-graph 写接口装配；维度 `dim` 显式传入，本系统不做推断。

## 4. 非目标（MVP 不做）

- 图存储、图算法、权限（全部收敛在 dynamic-graph）。
- 前端编辑 / 写入能力（只做可视化）。
- 通用 agent 能力（文件 / 命令）——禁用四基础工具即排除。

## 5. 验收要点

| 项 | 验收 |
|---|---|
| 工具集 | graph-agent 仅暴露图谱构建工具，四基础工具不可用 |
| 构建链路 | agent 读语料 → 拆两层节点 → 写 dynamic-graph 可查 |
| 可视化 | graph-viz 只读展示 agent 构建的图谱；多尺度 / 布局 / 筛选生效 |
| 身份 | 请求均带 X-Identity，dynamic-graph 返回 200（非 401） |
