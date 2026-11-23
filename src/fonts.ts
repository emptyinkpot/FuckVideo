import { continueRender, delayRender, staticFile } from "remotion";

/**
 * 项目自带的字体，渲染结果不依赖电脑上装了什么字体。
 * - Inter：拉丁字母、数字
 * - Noto Sans SC（思源黑体）：中文
 * - Noto Serif SC（思源宋体）：衬线中文、文件类画面
 * 三者都是 SIL Open Font License，许可证在 public/fonts/ 下。
 * 字体加载完成前截图会等待，避免某一帧用了系统后备字体。
 */
export const FONT_SANS = "Inter, 'Noto Sans SC', sans-serif";
export const FONT_SERIF = "'Noto Serif SC', serif";

const fonts = [
  { family: "Inter", file: "fonts/InterVariable.ttf" },
  { family: "Noto Sans SC", file: "fonts/NotoSansSC-VF.ttf" },
  { family: "Noto Serif SC", file: "fonts/NotoSerifSC-VF.ttf" },
];

if (typeof document !== "undefined") {
  for (const { family, file } of fonts) {
    const handle = delayRender(`Loading font ${family}`);
    const face = new FontFace(family, `url(${staticFile(file)})`, { weight: "100 900", style: "normal" });
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        continueRender(handle);
      })
      .catch((error) => {
        console.error(`Failed to load font ${family}`, error);
        continueRender(handle);
      });
  }
}
