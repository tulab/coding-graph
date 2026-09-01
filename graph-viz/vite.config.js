import { defineConfig } from "vite";

// dev 时把 /api 代理到后端（后端另可静态托管 dist，二选一即可）
export default defineConfig({
  server: {
    port: 8004,
    proxy: {
      // 图数据后端（dynamic-graph，独立项目，固定 3003）；graph-agent 已让出 3003 → 3004
      "/api": { target: "http://localhost:3003", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1024,
  },
});
