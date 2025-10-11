const path = require("path");

module.exports = {
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  target: "node",
  entry: "./server.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server.js",
    clean: true,
  },
  resolve: {
    extensions: [".js", ".json"],
  },
  externals: {
    // 保持原生模块为外部依赖
    fs: "commonjs fs",
    path: "commonjs path",
    url: "commonjs url",
    os: "commonjs os",
    http: "commonjs http",
    https: "commonjs https",
    crypto: "commonjs crypto",
    util: "commonjs util",
    stream: "commonjs stream",
    events: "commonjs events",
    buffer: "commonjs buffer",
    querystring: "commonjs querystring",
  },
  optimization: {
    minimize: process.env.NODE_ENV === "production",
  },
  // 复制静态文件到 dist 目录
  plugins: [
    {
      apply(compiler) {
        compiler.hooks.afterEmit.tap("CopyStaticFiles", () => {
          const fs = require("fs");
          const path = require("path");

          // 复制 public 目录
          const publicDir = path.join(__dirname, "public");
          const distPublicDir = path.join(__dirname, "dist", "public");

          if (fs.existsSync(publicDir)) {
            // 递归复制目录
            function copyDir(src, dest) {
              if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
              }

              const entries = fs.readdirSync(src, { withFileTypes: true });
              for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                if (entry.isDirectory()) {
                  copyDir(srcPath, destPath);
                } else {
                  fs.copyFileSync(srcPath, destPath);
                }
              }
            }

            copyDir(publicDir, distPublicDir);
            console.log("✅ 静态文件已复制到 dist/public");
          }
        });
      },
    },
  ],
};
