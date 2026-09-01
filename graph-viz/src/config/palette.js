// 展示配色：低饱和调色板 + 类型码确定性映射；不绑定任何业务枚举（枚举经接口下发）。
const PALETTE = [
  "#9c7b3f", "#b06a4a", "#a88f44", "#b07b8a", "#a3653f", "#7d9a6b",
  "#7a6f9b", "#4f8a8b", "#5b8db8", "#d9a05b", "#c67b7b", "#7fa86a",
];
const DEFAULT_COLOR = "#9aa0a6";
export const EDGE_COLOR = "#b7ab99"; // 边本体色（WebGL 边体与标签层线段共用）

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function nodeColor(type, _level) {
  return PALETTE[hash(String(type)) % PALETTE.length] || DEFAULT_COLOR;
}

// 半透明：维度筛选三态中的 "半透明" 用节点自身 alpha 表达。
// 2D 标签层（徽标淡底 / 卡片描边）用非预乘 rgba 即可（canvas 自行合成）；
// WebGL 圆点用 fadeWebGL 的预乘色，见下。
export function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// WebGL 预乘淡色：sigma 节点 program 用 blendFunc(ONE, ONE_MINUS_SRC_ALPHA) 预乘混合，
// 非预乘的 rgba 会以原色满强度叠加、产生"发光"假象；对 RGB 预乘后 alpha 才真正衰减圆点本身。
export function fadeWebGL(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * alpha);
  const g = Math.round(((n >> 8) & 255) * alpha);
  const b = Math.round((n & 255) * alpha);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
