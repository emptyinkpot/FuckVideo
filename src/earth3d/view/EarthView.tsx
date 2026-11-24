import { ThreeCanvas } from "@remotion/three";
import { useEffect, useReducer } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { FONT_SANS } from "../../fonts";
import { cameraPose } from "../core/camera";
import { GlobeScene, type GlobeSceneProps } from "../globe/GlobeScene";
import { builtTileCount, subscribeTiles } from "../globe/terrain/tileStore";
import { gradeFilter, resolveStyle } from "../styles";
import { screenProjector } from "./screenProjection";

export type EarthViewProps = GlobeSceneProps & {
  /** full、globe 两种通道的背景色；overlay、labels 通道总是透明背景 */
  background?: string;
};

/**
 * 一个完整的地球画面：三维画布（基础地球 + 图层的贴地内容、三维对象）加上 HTML 文字层。
 * 用 pass 分层导出时：
 * - full：全部；globe：只有基础地球；
 * - overlay：只有图层的贴地内容和三维对象，透明背景；
 * - labels：只有文字，透明背景。三维画布照常加载地形但不出颜色，文字位置和完整画面完全一致。
 * 透明背景的导出需要支持透明的格式，例如 --image-format=png --codec=prores --prores-profile=4444。
 */
export const EarthView = ({ background = "black", ...props }: EarthViewProps) => {
  const { width, height } = useVideoConfig();
  const pass = props.pass ?? "full";
  // 地形分块加载后文字高度随之更新
  const [, bump] = useReducer((value: number) => value + 1, 0);
  useEffect(() => subscribeTiles(bump), []);

  const transparent = pass === "overlay" || pass === "labels";
  const showLabels = pass === "full" || pass === "labels";
  const project = screenProjector(cameraPose(props.view), width, height);
  const layers = [...(props.layers ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const style = resolveStyle(props.style);
  const vignette = style.grade.vignette;

  return (
    <AbsoluteFill style={{ background: transparent ? "transparent" : background }}>
      {/* 风格的整体调色只作用在三维画布上，文字不受影响 */}
      <AbsoluteFill style={{ filter: gradeFilter(style) }}>
        <ThreeCanvas
          width={width}
          height={height}
          flat
          gl={{ logarithmicDepthBuffer: true, antialias: true, alpha: true }}
          camera={{ fov: 35, near: 0.0005, far: 400000 }}
        >
          {pass === "labels" ? <GlobeScene {...props} pass="overlay" layers={[]} /> : <GlobeScene {...props} />}
        </ThreeCanvas>
      </AbsoluteFill>
      {vignette > 0 && (pass === "full" || pass === "globe") ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${vignette}) 100%)`,
          }}
        />
      ) : null}
      {showLabels
        ? layers.map((layer) =>
            layer.labels ? (
              <AbsoluteFill key={layer.id} style={{ opacity: layer.opacity ?? 1, pointerEvents: "none" }}>
                {layer.labels(project)}
              </AbsoluteFill>
            ) : null,
          )
        : null}
      {builtTileCount === 0 && pass !== "labels" ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            fontFamily: FONT_SANS,
            fontSize: 30,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          <div>
            地形数据还没有生成
            <br />
            <span style={{ fontSize: 22, opacity: 0.8 }}>
              运行 src/earth3d/rebuild.bat，或重新打开 start.bat（约一小时，见 src/earth3d/README.md）
            </span>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
