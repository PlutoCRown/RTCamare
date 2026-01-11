const path = require("path");

module.exports = {
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  target: "node",
  entry: "./server/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server/index.js",
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
};
