// AgentRuntime：顶层门面，持有四层实例并编排 skill 加载与工具注册。
// Capability：SkillLoader + ToolRegistrar；Context：PromptComposer；Workspace：最小占位。
// LLM 面只暴露 loadSkill / unloadSkill 两个薄壳工具 + 已注册 skill 工具。
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { SkillLoader } from "./skill-loader.js";
import { ToolRegistrar } from "./tool-registrar.js";
import { createPromptComposer } from "./prompt.js";
import { Workspace } from "./workspace.js";

const MODEL_PROVIDER = "deepseek";
const MODEL_ID = "deepseek-v4-flash";

export class AgentRuntime {
  constructor() {
    this.modelRuntime = null;
    this.session = null;
    this.workspace = new Workspace();
    this.toolHandlers = {}; // skillName -> { toolName -> execute }（skill 工具的 handler，按 skill 挂）
    this.#resetCapability();
  }

  #resetCapability() {
    this.skillLoader = new SkillLoader();
    this.toolRegistrar = new ToolRegistrar({ getAgent: () => this.session?.agent ?? null });
    this.promptComposer = createPromptComposer({
      getSkillContent: () => this.skillLoader.getLoadedContent() || null,
      getWorkspaceContext: () => null,
    });
  }

  // 给 skill 挂工具执行 handler；loadSkill 时据此把 scripts/tools.json 的工具注册进 session
  setToolHandlers(skillName, handlers) {
    this.toolHandlers[skillName] = { ...(this.toolHandlers[skillName] ?? {}), ...handlers };
  }

  async ensureSession() {
    if (this.session) return this.session;
    await this.#buildSession();
    return this.session;
  }

  reset() {
    if (this.session) {
      try {
        this.session.dispose();
      } catch {
        // 忽略 dispose 异常
      }
      this.session = null;
    }
    this.#resetCapability(); // 清空已加载 skill 与工具，toolHandlers 保留（静态定义）
  }

  async #buildSession() {
    const rt = await this.#getModelRuntime();
    const model = rt.getModel(MODEL_PROVIDER, MODEL_ID);
    if (!model) throw new Error(`模型未找到: ${MODEL_PROVIDER}/${MODEL_ID}`);

    const loader = new DefaultResourceLoader({
      cwd: process.cwd(),
      agentDir: process.env.AGENT_DIR || "~/.pi/agent",
      noSkills: true,
      noExtensions: true,
      noPromptTemplates: true,
      noContextFiles: true,
      extensionFactories: [
        (pi) => {
          // 每轮注入完整 systemPrompt（覆盖 pi 默认提示词与 cwd）
          pi.on("before_agent_start", () => ({ systemPrompt: this.promptComposer.build() }));
        },
      ],
    });
    await loader.reload();

    const { session } = await createAgentSession({
      model,
      modelRuntime: rt,
      resourceLoader: loader,
      noTools: "all", // 基础四工具全禁；工具集完全由 state.tools 管理
      sessionManager: SessionManager.inMemory(),
    });
    this.session = session;

    // 初始工具：loadSkill / unloadSkill（写入 state.tools，下一轮生效）
    this.toolRegistrar.registerTool(this.#loadSkillDef(), (params) => this.#onLoadSkill(params));
    this.toolRegistrar.registerTool(this.#unloadSkillDef(), (params) => this.#onUnloadSkill(params));
  }

  async #getModelRuntime() {
    if (this.modelRuntime) return this.modelRuntime;
    const rt = await ModelRuntime.create({ modelsPath: null, allowModelNetwork: false });
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("缺少 DEEPSEEK_API_KEY 环境变量");
    rt.registerProvider(MODEL_PROVIDER, {
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      apiKey,
      api: "openai-completions",
      models: [
        {
          id: MODEL_ID,
          name: "DeepSeek V4 Flash",
          reasoning: true,
          thinkingLevelMap: { off: "none", low: "low", high: "high", max: "max" },
          input: ["text"],
          contextWindow: 1000000,
          maxTokens: 384000,
          cost: { input: 3, output: 9, cacheRead: 0.1, cacheWrite: 0 },
        },
      ],
    });
    await rt.setRuntimeApiKey(MODEL_PROVIDER, apiKey);
    this.modelRuntime = rt;
    return rt;
  }

  #onLoadSkill({ name }) {
    const skill = this.skillLoader.loadSkill(name);
    const { registered, skipped } = this.toolRegistrar.registerFromSkill(name, {
      handlerFor: (toolName) => this.toolHandlers[name]?.[toolName],
    });
    return {
      loaded: name,
      content_chars: skill.content.length,
      tools_registered: registered,
      tools_skipped: skipped,
    };
  }

  #onUnloadSkill({ name }) {
    this.skillLoader.unloadSkill(name);
    this.toolRegistrar.unregisterFromSkill(name);
    return { unloaded: name };
  }

  #loadSkillDef() {
    return {
      name: "loadSkill",
      description:
        "加载指定 skill 的全量规则到当前上下文（SKILL.md 内容），并自动注册该 skill 在 scripts/tools.json 中声明的工具。已加载的规则与工具从下一轮起对模型可见。",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "要加载的 skill 名，如 growing-graph" } },
        required: ["name"],
      },
      label: "加载 Skill",
    };
  }

  #unloadSkillDef() {
    return {
      name: "unloadSkill",
      description: "从上下文移除指定 skill 的全量规则，并反注册该 skill 注册的工具。",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "要卸载的 skill 名" } },
        required: ["name"],
      },
      label: "卸载 Skill",
    };
  }
}
