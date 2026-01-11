import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginBasicSsl } from "@rsbuild/plugin-basic-ssl";
import path from "path";

export default defineConfig({
  plugins: [pluginReact(), pluginBasicSsl()], // plugin-basic-ssl 会自动启用 HTTPS
  html: {
    template: "./src/index.html",
  },
  output: {
    distPath: {
      root: path.resolve(__dirname, "../dist/public"),
    },
  },
  source: {
    entry: {
      index: "./src/main.tsx",
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
      "/config": {
        target: "http://localhost:8080", // 后端使用 HTTP
        changeOrigin: true,
      },
    },
  },
});
