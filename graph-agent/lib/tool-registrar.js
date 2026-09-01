// ToolRegistrar：Capability Layer，维护 tools 状态（registered AgentTool、归属）。
// 工具定义从 skill 的 scripts/tools.json（MCP 格式）加载，不从脚本直接加载。
// 动态更新机制：session.agent.state.tools 直接赋值替换工具集（pi-core 文档规定），下一轮生效。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 与 skill-loader.js 同根：项目根 .agents/skills；AGENT_SKILLS_DIR 可覆盖。
const SKILLS_ROOT =
  process.env.AGENT_SKILLS_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".agents", "skills");

export class ToolRegistrar {
  // getAgent: () => session.agent | null —— 由运行时注入，保持本类与 pi session 解耦
  constructor({ getAgent, skillsRoot = SKILLS_ROOT }) {
    this.tools = new Map(); // name -> AgentTool
    this.owners = new Map(); // name -> skillName | "base"
    this.getAgent = getAgent;
    this.skillsRoot = skillsRoot;
  }

  // 注册单个工具。owner = "base"（如 loadSkill/unloadSkill）或 skillName（skill 工具）
  registerTool(def, execute, owner = "base") {
    this.tools.set(def.name, this.#toAgentTool(def, execute));
    this.owners.set(def.name, owner);
    this.#sync();
    return def.name;
  }

  unregisterTool(name) {
    this.tools.delete(name);
    this.owners.delete(name);
    this.#sync();
  }

  // 注册某个 skill 的 scripts/tools.json 中声明的全部工具。
  // handlerFor(name) 返回 execute 函数；无 handler 的工具跳过并列入 skipped。
  // 返回 { registered, skipped }
  registerFromSkill(skillName, { handlerFor } = {}) {
    const file = join(this.skillsRoot, skillName, "scripts", "tools.json");
    if (!existsSync(file)) return { registered: [], skipped: [] };
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    const defs = Array.isArray(raw) ? raw : raw.tools ?? [];
    const registered = [];
    const skipped = [];
    for (const def of defs) {
      const execute = handlerFor?.(def.name);
      if (!execute) {
        skipped.push(def.name);
        continue;
      }
      this.registerTool(def, execute, skillName); // 逐个走 registerTool
      registered.push(def.name);
    }
    return { registered, skipped };
  }

  // 反注册某个 skill 拥有的全部工具（逐个走 unregisterTool）
  unregisterFromSkill(skillName) {
    for (const [name, owner] of [...this.owners]) {
      if (owner === skillName) this.unregisterTool(name);
    }
  }

  getTools() {
    return [...this.tools.values()];
  }

  // MCP JSON 定义 → AgentTool（name/description/parameters/label/execute）
  #toAgentTool(def, execute) {
    return {
      name: def.name,
      description: def.description ?? "",
      parameters: def.inputSchema ?? def.parameters ?? { type: "object", properties: {} },
      label: def.label ?? def.name,
      execute: async (toolCallId, params, signal, onUpdate) => {
        const result = await execute(params, { signal });
        return {
          content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result) }],
          details: {},
        };
      },
    };
  }

  // 把当前工具集写进 session.agent.state.tools（替换式动态更新）
  #sync() {
    const agent = this.getAgent?.();
    if (agent) agent.state.tools = [...this.tools.values()];
  }
}
