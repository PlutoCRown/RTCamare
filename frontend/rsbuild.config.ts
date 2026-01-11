import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [pluginReact()],
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
        target: "https://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
