// PromptComposer：Context Layer，每轮组合 System / Skill / Workspace / History 进 systemPrompt。
// 经 before_agent_start 注入（完全覆盖 pi 默认提示词），必须总返回完整提示词，维持无 cwd、无默认骨架。
import { SYSTEM_PROMPT } from "../config.js";

export function createPromptComposer({ getSkillContent, getWorkspaceContext } = {}) {
  return {
    build() {
      let prompt = SYSTEM_PROMPT;
      const workspace = getWorkspaceContext?.();
      if (workspace) prompt += `\n\n## Workspace\n\n${workspace}`;
      const skills = getSkillContent?.();
      if (skills) prompt += `\n\n## 已加载 skill 规则\n\n${skills}`;
      return prompt;
    },
  };
}
