// graph-agent 服务入口：HTTP + SSE。业务逻辑全部在 AgentRuntime（lib/runtime.js）。
// POST /api/chat  { message } -> SSE 流式返回 assistant 回复
// POST /api/chat/reset -> 清空当前对话与已加载 skill/工具
import http from "node:http";
import { AgentRuntime } from "./lib/runtime.js";

const PORT = process.env.PORT || 3004;

const runtime = new AgentRuntime();

// SSE 流式：把 pi 的 text_delta 事件转发给浏览器，prompt 完成后收尾
function streamReply(res, sess, message) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    res.end();
  };
  res.on("close", close);

  const unsubscribe = sess.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ delta: event.assistantMessageEvent.delta })}\n\n`);
    }
  });

  void (async () => {
    try {
      await sess.prompt(message); // 等本轮回复结束
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: String(err?.message || err) })}\n\n`);
    } finally {
      close();
    }
  })();
}

const server = http.createServer(async (req, res) => {
  // CORS：本地开发放行 localhost 任意端口
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  if (req.method === "POST" && req.url === "/api/chat/reset") {
    runtime.reset();
    res.writeHead(200).end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let message;
    try {
      message = JSON.parse(body || "{}").message;
    } catch {
      res.writeHead(400).end(JSON.stringify({ error: "bad json" }));
      return;
    }
    if (typeof message !== "string" || !message.trim()) {
      res.writeHead(400).end(JSON.stringify({ error: "message 必填" }));
      return;
    }
    try {
      const s = await runtime.ensureSession();
      streamReply(res, s, message);
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ error: String(err?.message || err) }));
    }
    return;
  }

  res.writeHead(404).end("not found");
});

async function start() {
  await runtime.ensureSession();
  server.listen(PORT, () => {
    console.log(`graph-agent listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
