# coding-graph 智能体

把需求 / 设计文本构建为两层节点模型知识图谱的智能体项目。图谱数据经独立的图引擎微服务 **dynamic-graph**（FastAPI + SQLite）存储，本仓只承担：

- **graph-agent**（node 后端，待建）：内嵌 [pi agent SDK](https://github.com/earendil-works/pi)（`@mariozechner/pi-coding-agent`），**禁用基础四工具**（read / bash / edit / write），仅注入图谱构建工具调用 dynamic-graph 写接口；构建规则见 `skills/coding-graph/SKILL.md`
- **graph-viz**（node 前端）：沿用 `web-frontend/` 半成品，仅作可视化（只读）

## 结构

```
graph-agent/            node 后端（待建）：pi agent SDK 装配 + 图谱构建工具
graph-viz/              可视化前端（沿用 web-frontend 半成品）
skills/coding-graph/    agent 构建规则（SKILL.md，依据《需求图谱Schema设计》）
extract/                领域语料（agent 输入素材）
docs/                   需求 / 设计文档
```

## 运行

后端（node，待建）与前端（node，已存在）：

```bash
cd graph-viz && npm install
npm run dev          # http://localhost:8003（/api 代理到后端 :3003）
```

- 身份：本仓是调用方，经 `X-Identity` 请求头（base64(JSON)，含 user_id）访问 dynamic-graph；测试阶段前端写死 `{"user_id":"admin"}`。
- 前端依赖 dynamic-graph 运行（默认 http://localhost:3003）；数据由 agent 经写接口构建。

## 文档

- `docs/需求文档/PRD.md` —— 需求（完整）
- `docs/设计文档/架构概览.md` —— 架构（graph-agent + graph-viz + dynamic-graph 协作）
- `docs/设计文档/graph-viz/` —— graph-viz 前端设计（`README.md` 总览 + 加载流程 / 多尺度 / 布局 / 维度筛选 / 交互 / 界面视觉）
- `docs/设计哲学/需求图谱Schema设计.md` —— 领域依据（两层节点模型 Schema）
