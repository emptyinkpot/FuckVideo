// webpack 的 require.context：在打包时列出目录下的文件，返回每个文件的地址。
interface EarthAssetContext {
  keys(): string[];
  (id: string): string;
}

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories: boolean, pattern: RegExp): EarthAssetContext;
  }
}

declare module "*.bin" {
  const url: string;
  export default url;
}

declare module "*.geojson" {
  const url: string;
  export default url;
}
