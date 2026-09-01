# 需求图谱 · Schema 设计

本文定义需求分析阶段知识图谱的完整 Schema：**两层节点模型** + 全部关系类型。

需求图谱由两个并存的语义层组成，本质都是需求层，区别在**表现形式**：文本层承载需求文本短句，实体层承载从文本中提取的领域实体。

```
文本层 ────(跨层边: involves / operates_on / realizes / triggered_by)──── 实体层

文本层节点: Goal · Feature · Behavior · Rule · Quality · Scenario · Reason · Strategy · Assumption
实体层节点: Actor · Action · Domain · Attribute · Condition · Event
```

---

## 1. Object Types（节点类型）

### 1.1 节点类型总表（15 种）

| Object Type | Object Name | 层 | 性质 | 回答的问题 | 判断标准 |
|---|---|---|---|---|---|
| `Goal` | 目标 | 文本层 | 主线 | 为什么要做 | 无实现细节，表达意图或价值 |
| `Feature` | 功能 | 文本层 | 主线 | 系统提供什么能力 | 用户视角的可见能力 |
| `Behavior` | 行为 | 文本层 | 主线 | 具体怎么表现 | 含触发条件或系统响应 |
| `Rule` | 规则 | 文本层 | 约束 | 有什么约束条件 | 含"必须/不允许/仅当" |
| `Quality` | 质量 | 文本层 | 约束 | 非功能性要求 | 含量化指标 |
| `Scenario` | 场景 | 文本层 | 约束 | 用户怎么用（前端设计）/ 系统须满足什么（后端契约） | 前端设计的使用情境 / 交互流程（什么用户在什么情境下做什么事），或系统对外的行为契约（输入 → 处理 → 输出，限定系统必须提供的服务） |
| `Reason` | 原因 | 文本层 | 依赖 | 为什么做（现状缺口 / 外部归因） | 现状不满足（缺失 / 痛点），或目标 / 功能的外部动因（市场 / 政策 / 用户 / 竞品） |
| `Strategy` | 策略 | 文本层 | 依赖 | 有什么宏观约束 | 事实性语言陈述的设计思想 / 产品边界 / 规律认知 |
| `Assumption` | 假设 | 文本层 | 依赖 | 需求依赖什么前提 | 需求成立所依赖的不确定前提（数据 / 技术 / 环境 / 用户行为等）；前提不成立则该需求需重新评估 |
| `Actor` | 角色 | 实体层 |  | 谁发起操作 | 主语角色 |
| `Action` | 操作 | 实体层 |  | 做什么动作 | 动词 |
| `Domain` | 领域 | 实体层 |  | 被操作的事物 | 名词宾语 |
| `Attribute` | 属性 | 实体层 |  | 领域的特征 | 名词性属性 |
| `Condition` | 条件 | 实体层 |  | 触发上下文 | 条件状语 |
| `Event` | 事件 | 实体层 |  | 触发点或结果 | 事件名词 |

文本层节点按角色分三组：**主线**（Goal / Feature / Behavior——目标、功能、行为，需求分析主线）、**约束**（Rule / Quality / Scenario——规则、质量、场景，限定主线怎么做）、**依赖**（Reason / Strategy / Assumption——原因、策略、假设，为什么做与依赖什么前提）。跨层边与 `constrained_by` 仅从行为性节点（Feature / Behavior / Scenario）出发。

---

## 2. Link Types（关系类型）

### 2.1 关系类型总表（15 种）

| Link Type | Link Name | 层 | 方向 | 语义 |
|---|---|---|---|---|
| `motivated_by` | 由…驱动 | 文本层 | 具体 → 抽象 | 该需求因某目标或原因而存在 |
| `decomposes_into` | 拆分为 | 文本层 | 整体 → 部分 | 目标 / 功能 / 场景拆分为子项（总-分） |
| `elaborates` | 细化 | 文本层 | 粗 → 细 | 对同一件事的更详细描述 |
| `specializes` | 特化为 | 文本层 | 通用 → 条件限定 | 在特定条件下的变体 |
| `depends_on` | 依赖 | 文本层 | 双向有序 | 实现或理解上的前置依赖 |
| `conflicts_with` | 与…冲突 | 文本层 | 双向对称 | 两个需求无法同时满足 |
| `constrained_by` | 受…约束 | 文本层 | 行为性节点 → Rule/Strategy | 功能、行为或场景受某规则或策略约束 |
| `performs` | 执行 | 实体层 | Actor → Action | 角色执行操作 |
| `targets` | 作用于 | 实体层 | Action → Domain | 操作作用于对象 |
| `has_attribute` | 具有属性 | 实体层 | Domain → Attribute | 对象具有属性 |
| `applies_to` | 应用于 | 实体层 | Condition → Action/Feature | 条件作用于什么 |
| `involves` | 涉及 | 跨层 | 行为性节点 → Actor | 该需求涉及哪个角色 |
| `operates_on` | 操作对象 | 跨层 | 行为性节点 → Domain | 该需求操作哪个对象 |
| `realizes` | 实现为 | 跨层 | 行为性节点 → Action | 该需求对应哪个具体操作 |
| `triggered_by` | 由…触发 | 跨层 | 行为性节点 → Condition/Event | 触发条件 |

### 2.2 分层的三条边

**文本层内部（7 条）**：垂直边 `motivated_by` / `decomposes_into` / `elaborates` / `specializes`，水平边 `depends_on` / `conflicts_with`，层内跨层边 `constrained_by`（源与目标都在文本层：行为性节点 → Rule/Strategy）。`Assumption` 作为需求成立的前提经 `depends_on` 挂接。

**实体层内部（4 条）**：`performs` → `targets` → `has_attribute` 组成实体动作链，`applies_to` 挂接条件。

**跨层边（4 条）**：仅从文本层行为性节点（Feature/Behavior/Scenario）指向实体层节点，是两层之间唯一的连接通道；不得出现在实体层内部或反向连接。

### 2.3 判断要点

- `decomposes_into` vs `elaborates`：拆分后的子节点可独立存在 → `decomposes_into`；只是对父节点同一事物的补充描述 → `elaborates`。
- 场景 / 行为辨析：`Scenario` 使用情境或契约（前端交互流程 / 后端行为契约）、`Behavior` 单个系统响应；场景 `specializes` 所属功能、`decomposes_into` 拆成行为步骤、`depends_on` 依赖相关场景 / 节点。
- 实体动作链是单一语义单位：`Actor —performs→ Action —targets→ Domain`。跨层边 `realizes` 连接文本层行为性节点到这条链上的 Action。
- `constrained_by` 是层内跨层：源与目标都在文本层，与连接两层的跨层边（`involves` 等）不是一回事。
- 跨层边只能从文本层行为性节点出发，不能出现在实体层内部或反向连接。

---

## 3. 维度（Dimension）

图谱声明一组自定义维度，维度及其取值（含显示名）构成维度字典，经 `graph.dims` 下发，前端据此生成筛选与布局。

| 维度 | 维度名 | 取值（code · 显示名） |
|---|---|---|
| `level` | 层级 | `textual` 文本层 · `entity` 实体层 |
| `stage` | 阶段 | `requirement` 需求 · `design` 设计 |

对象类型按 `level` 标注所属层；实例按 `level` / `stage` 标注，供筛选与布局使用。

## 4. 属性类型（Property Types）

属性类型绑定到具体对象类型（该对象类型允许哪些属性键）；实例 `property` 的键须在该对象类型的属性字典内。

| 对象类型 | 允许的属性键 |
|---|---|
| goal | priority 优先级 |
| feature | priority 优先级 · status 状态 |
| behavior | trigger 触发条件 |
| rule | severity 严重度 |
| quality | metric 指标 · target 目标值 |
| scenario | priority 优先级 · result 结果 |
| reason | source 来源 |
| strategy | scope 适用范围 |
| assumption | confidence 置信度 |
| actor | role 角色 |
| action | input 输入 |
| domain | owner 归属 |
| attribute | unit 单位 |
| condition | severity 严重度 |
| event | source 来源 |

## 5. 字典应用

本字典是需求图谱（应用层）的完整 Schema 定义。应用层通过引擎写接口装配：建图谱时声明维度字典（`graph.dims`，创建后不可修改），再按本表创建对象 / 关系 / 属性类型与实例。引擎不预置任何内容，也不做 dim 推断——`level` / `stage` 等维度取值由应用层显式传入。

---

## 6. Agent 生成原则

本节是构建图谱时给 Agent 的更底层生成原则，不针对某个具体类型，适用于整张图的构建。

### 6.1 节点粒度

一个节点只包含一个主语、一个动作、一个对象。节点文本含"并且/同时/以及"时强制拆分。该原则对两层同样适用：文本层节点是原子短句，实体层节点是原子实体。

### 6.2 文本语义判断原则（需求阶段）

一段文本是否属于**需求表达**，须同时满足以下三个原则；任一条不满足即不属于，应从图谱中剔除或改写后再纳入：

1. **主谓宾完整**：具备主语 - 谓语 - 宾语结构，是一个完整短句，不是词组或孤立短语。
2. **抽象与概括**：具备一定的抽象和概括级别——本身还不是可执行实现，需要更具体、细致的设计和实现。
3. **交付标准**：本身可以直接作为最终交付标准——可独立实现、可独立验证。
