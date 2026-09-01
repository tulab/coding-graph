// 通用 API 客户端 + 系统级接口入口（前端 core 层）。
// get/post 是底层工具；system 是系统级接口归属地（鉴权 / 配置等，未来扩展在此增加）。
// 接口一律放 ../api/<module>.js，按路由前缀调用，对应后端 graph 包。
const BASE = "/api";

// 调用方身份：后端 graph 为微服务、不内置鉴权，身份由调用方注入（X-Identity 头，值 base64(JSON)，含 user_id / agent_id）。
// 测试阶段写死 admin；未来接登录 / 会话后替换为真实身份。
const _enc = new TextEncoder();
const b64 = (s) => btoa(String.fromCharCode(..._enc.encode(s)));
export const currentUser = { user_id: "admin" };
const IDENTITY = b64(JSON.stringify(currentUser));

async function req(path, options = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "X-Identity": IDENTITY, ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(`请求失败 ${r.status}: ${await r.text()}`);
  return r.json();
}

export function get(path) {
  return req(path);
}

export function post(path, body) {
  return req(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// 系统级接口（未来扩展点）：鉴权 / 配置 / 健康检查等统一走 core，不进业务模块。
// 例：export const system = { auth: (d) => post("/auth/login", d), config: () => get("/config") };
export const system = {};
