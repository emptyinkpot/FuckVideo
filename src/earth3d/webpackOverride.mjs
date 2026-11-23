// earth3d 的打包规则：地形分块（.e3d）、河流和国界数据（.bin）、地理边界（.geojson）
// 放在 src/earth3d/assets/ 和 src/earth3d/data/，通过 require.context / import 引用，
// 需要让 webpack 把它们当作普通文件输出，运行时再按需加载。
// remotion.config.ts（Studio、命令行渲染）和 tests/verify-upstream.mjs（Node API 打包，
// 不读 remotion.config.ts）都用这一份。
export const earth3dWebpackOverride = (config) => ({
  ...config,
  module: {
    ...config.module,
    rules: [...(config.module?.rules ?? []), { test: /\.(e3d|bin|geojson)$/, type: "asset/resource" }],
  },
});
