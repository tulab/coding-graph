// SkillLoader：Capability Layer，维护 skills 状态（loadedSkills、SKILL.md 缓存）。
// 纯状态类，不依赖 pi session；加载/卸载只改自身状态，注入由 PromptComposer 负责。
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

// 项目根 .agents/skills：相对本文件（<root>/graph-agent/lib/）上溯两级；AGENT_SKILLS_DIR 可覆盖。
const DEFAULT_SKILLS_ROOT =
  process.env.AGENT_SKILLS_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".agents", "skills");

export class SkillLoader {
  constructor(skillsRoot = DEFAULT_SKILLS_ROOT) {
    this.skillsRoot = skillsRoot;
    this.loaded = new Map(); // name -> { name, filePath, content }
  }

  loadSkill(name) {
    const filePath = join(this.skillsRoot, name, "SKILL.md");
    if (!existsSync(filePath)) {
      throw new Error(`skill 不存在: ${name}（${filePath}）`);
    }
    const raw = readFileSync(filePath, "utf-8");
    const content = raw.replace(FRONTMATTER_RE, "").trim();
    const entry = { name, filePath, content };
    this.loaded.set(name, entry);
    return entry;
  }

  unloadSkill(name) {
    this.loaded.delete(name);
  }

  getLoaded() {
    return [...this.loaded.values()];
  }

  // 供 PromptComposer 拼进 systemPrompt 的全文块
  getLoadedContent() {
    return this.getLoaded()
      .map((s) => `<skill name="${s.name}" location="${s.filePath}">\n${s.content}\n</skill>`)
      .join("\n\n");
  }
}
