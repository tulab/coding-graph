# 设计文档 · 前端可视化（graph-viz）

> graph-viz 是 coding-graph 的**只读可视化前端**：Vite 静态应用 + sigma 3（WebGL）+ graphology + antd（仅维度筛选面板用 React）。只消费 dynamic-graph 读端点，不触发写请求。
> 实现配套：`graph-viz/docs/图谱引擎.md`（引擎）、`graph-viz/docs/组件.md`（组件）。

## 1. 系统定位

- **只读展示**：布局、多尺度、筛选、交互均为展示层职责，不触发写请求；
- **身份注入**：`X-Identity` 头（base64(JSON)）由调用方注入，后端按身份过滤图谱列表；
- **数据驱动**：节点 / 关系 / 类型 / 维度字典全部经接口下发，不硬编码业务枚举。

```mermaid
graph LR
    Agent["🤖 graph-agent<br/>智能体构建层"]
    Viz["🖥️ graph-viz<br/>可视化前端"]
    DS[("🗄️ dynamic-graph<br/>FastAPI · SQLite")]
    User["👤 用户"]

    User --> Viz
    Agent -->|"写 + 探查 · REST/JSON"| DS
    Viz -->|"只读 · REST/JSON（X-Identity）"| DS

    classDef agent fill:#90EE90,stroke:#333,stroke-width:2px,color:darkgreen
    classDef viz fill:#87CEEB,stroke:#333,stroke-width:2px,color:darkblue
    classDef data fill:#E6E6FA,stroke:#333,stroke-width:2px,color:darkblue
    class Agent agent
    class Viz viz
    class DS data
```

## 2. 架构与渲染分层

```mermaid
graph TB
    subgraph G["graph-viz（Vite 静态前端）"]
        M["🛬 main.js<br/>boot · renderGraph"]
        TB["🧰 Toolbar<br/>图谱选择 / 缩放 / 力导向 / 维度筛选"]
        LG["🗺️ Legend<br/>层级分组图例"]
        subgraph V["👁️ sigmaEngine 视图"]
            SIG["⚙️ sigma WebGL<br/>节点本体 · 拾取"]
            LAB["🖌️ Canvas 标签层<br/>卡片 / 标题 / 边标签 / 高亮"]
            DIV["📏 SVG 覆盖层<br/>stage 虚竖线"]
        end
        LY["📐 layout.js<br/>确定性网格"]
        FY["🌀 forceLayout.js<br/>d3-force"]
        PR["🎨 nodeProgram.js<br/>多尺度绘制"]
        SC["📏 scale.js<br/>尺度判定"]
        PL["🎨 palette.js<br/>低饱和配色"]
        TP["💬 tooltip.js"]
        API["🔌 api/graph.js<br/>X-Identity 客户端"]
    end
    B[("🗄️ dynamic-graph")]

    M --> TB
    M --> LG
    M --> V
    V --> SIG
    V --> LAB
    V --> DIV
    V --> LY
    V --> FY
    V --> PR
    V --> SC
    V --> PL
    V --> TP
    V --> API
    API --> B

    classDef entry fill:#90EE90,stroke:#333,stroke-width:2px,color:darkgreen
    classDef comp fill:#87CEEB,stroke:#333,stroke-width:2px,color:darkblue
    classDef layer fill:#E6E6FA,stroke:#333,stroke-width:2px,color:darkblue
    classDef util fill:#FFE4B5,stroke:#333,stroke-width:2px,color:black
    classDef data fill:#FFB6C1,stroke:#DC143C,stroke-width:2px,color:black

    class M,V entry
    class TB,LG comp
    class SIG,LAB,DIV layer
    class LY,FY,PR,SC,PL,TP,API util
    class B data
```

**三层渲染各司其职**：WebGL 本体层负责"可交互的图形"（圆点 + 边 + 拾取命中）；Canvas 标签层负责"可读的内容"（卡片 / 标题 / 边标签 / 高亮，屏幕坐标）；SVG 覆盖层负责"结构提示"（stage 虚竖线，随相机与布局 tick 重算）。三层解耦，互不干扰、可独立退化。

## 3. 文档索引

| 文档 | 内容 |
|---|---|
| [加载流程.md](加载流程.md) | 图谱加载数据流、视图生命周期 |
| [多尺度展示.md](多尺度展示.md) | 三态切换、动态卡片临界与进出对称、卡片渲染 |
| [布局.md](布局.md) | 确定性网格、d3-force 力导向 |
| [维度筛选.md](维度筛选.md) | 三态机制、与力导向协作 |
| [交互.md](交互.md) | 交互矩阵、节点拖拽 |
| [界面与视觉.md](界面与视觉.md) | 配色、工具栏、图例 |
