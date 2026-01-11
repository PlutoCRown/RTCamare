const path = require("path");

module.exports = {
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  target: "node",
  entry: "./server/index.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "server/index.js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "builtin:swc-loader",
            options: {
              jsc: {
                parser: {
                  syntax: "typescript",
                },
                target: "es2020",
              },
              module: {
                type: "commonjs",
              },
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
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
