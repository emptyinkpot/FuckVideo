import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { getTimelineScene } from "../camera/cameraPresets";
import {
  sinoJapaneseWarTimeline,
  subjectAliases,
  territoryColors,
} from "../data/sino-japanese-war.timeline";
import { EditableHistoricalWorldGlobe } from "../engine/EditableHistoricalWorldGlobe";
import { FrontlineLayer } from "../layers/FrontlineLayer";
import { getWorldState } from "../timeline/getWorldState";

const FPS = 30;
export const SINO_JAPANESE_WAR_SCENE_FRAMES = FPS * 5;
export const SINO_JAPANESE_WAR_DURATION =
  SINO_JAPANESE_WAR_SCENE_FRAMES * sinoJapaneseWarTimeline.length;

export type SinoJapaneseWarDemoProps = {
  title?: string;
  subtitle?: string;
  cardLeft?: number;
  cardBottom?: number;
  progressTop?: number;
  showProgressBar?: boolean;
};

const clampProgress = (frame: number) =>
  interpolate(frame, [0, SINO_JAPANESE_WAR_DURATION - 1], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const chinaOverlayNames = [
  "北京市",
  "天津市",
  "河北省",
  "山西省",
  "内蒙古自治区",
  "辽宁省",
  "吉林省",
  "黑龙江省",
  "上海市",
  "江苏省",
  "浙江省",
  "安徽省",
  "福建省",
  "江西省",
  "山东省",
  "河南省",
  "湖北省",
  "湖南省",
  "广东省",
  "广西壮族自治区",
  "海南省",
  "重庆市",
  "四川省",
  "贵州省",
  "云南省",
  "西藏自治区",
  "陕西省",
  "甘肃省",
  "青海省",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
  "台湾省",
  "香港特别行政区",
  "澳门特别行政区",
];

export const SinoJapaneseWarDemo = ({
  title = "1931-1945 中日战争演化",
  subtitle = "时间线、镜头聚焦、战线与地图填色联动",
  cardLeft = 48,
  cardBottom = 42,
  progressTop = 34,
  showProgressBar = true,
}: SinoJapaneseWarDemoProps) => {
  const frame = useCurrentFrame();
  const { current, next, progress, localFrame } = getTimelineScene(
    frame,
    sinoJapaneseWarTimeline,
    SINO_JAPANESE_WAR_SCENE_FRAMES,
  );

  const world = getWorldState(current, next, progress);
  const chinaColorOverrides = Object.fromEntries(
    [
      "Chinese warlords",
      "Tibet",
      "Xinjiang",
      ...chinaOverlayNames,
    ].map((name) => [name, territoryColors.china]),
  );
  const cardOpacity = interpolate(
    localFrame,
    [0, 18, SINO_JAPANESE_WAR_SCENE_FRAMES - 20, SINO_JAPANESE_WAR_SCENE_FRAMES],
    [0, 1, 1, 0.35],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ background: "#07090d", fontFamily: "Inter, Microsoft YaHei, Arial, sans-serif" }}>
      <EditableHistoricalWorldGlobe
        geoJsonSrc="geojson/historical-world-1938.geojson"
        overlayGeoJsonSrc="geojson/china-provinces-full.json"
        title={title}
        subtitle={subtitle}
        backgroundColor="#07090d"
        oceanColor="#0d2740"
        globeShadowColor="rgba(0,0,0,0.48)"
        showGraticule={false}
        graticuleColor="rgba(191,219,254,0.18)"
        borderColor="rgba(248,250,252,0.66)"
        borderWidth={0.58}
        coastGlowColor="rgba(255,255,255,0.22)"
        loopFrames={SINO_JAPANESE_WAR_DURATION}
        startLongitude={-world.camera.lon}
        rotationDegreesPerFrame={0}
        tiltLatitude={-world.camera.lat}
        projectionScale={230 * world.camera.zoom}
        projectionTranslateX={140}
        projectionTranslateY={18}
        governingField="SUBJECTO"
        regionNameField="NAME"
        governingAliases={subjectAliases}
        territoryColorOverrides={{
          ...chinaColorOverrides,
          ...world.territoryColorOverrides,
        }}
        territoryOverlayOpacity={1}
        worldFeaturePartOverrides={world.worldFeaturePartOverrides.map((override) => ({
          featureName: override.featureName,
          partIndexes: override.partIndexes,
          color: override.color,
        }))}
        subjectColorOverrides={{
          ...territoryColors,
          "Chinese warlords": territoryColors.china,
          Tibet: territoryColors.china,
          Xinjiang: territoryColors.china,
        }}
        hoiFallbackPalette={[
          "#8aa06a",
          "#b98d5f",
          "#6f91a8",
          "#a46f6a",
          "#9d8f58",
          "#6d8f7a",
          "#8c79a8",
          "#b3a160",
          "#5f8f9a",
          "#a87855",
        ]}
        defaultFill="#7f8f68"
        hatchRegionNames={["Spanish Sahara", "Mandatory Palestine (GB)"]}
        hatchSubjectNames={[]}
        overlayHatchRegionNames={world.hatchProvinces}
        hatchLineColor="#facc15"
        hatchLineWidth={1.5}
        hatchGap={8}
        hatchOpacity={0.72}
        hatchAngle={0}
        hatchStrokeColor="#facc15"
        hatchStrokeWidth={1.8}
        frontLines={[]}
        terrainLines={[
          {
            id: "himalaya",
            label: "喜马拉雅山脉",
            points: [
              [74, 35],
              [82, 31],
              [90, 29],
              [97, 28],
            ],
            color: "rgba(255,255,255,0.34)",
            width: 1.2,
            dash: "3 5",
          },
        ]}
        cities={[
          { label: "沈阳", lon: 123.43, lat: 41.8, color: "#fde68a" },
          { label: "长春", lon: 125.32, lat: 43.9, color: "#fde68a" },
          { label: "北京", lon: 116.4074, lat: 39.9042, color: "#fde68a" },
          { label: "上海", lon: 121.4737, lat: 31.2304, color: "#fde68a" },
          { label: "南京", lon: 118.7969, lat: 32.0603, color: "#fde68a" },
          { label: "武汉", lon: 114.3055, lat: 30.5928, color: "#fde68a" },
          { label: "重庆", lon: 106.5516, lat: 29.563, color: "#fde68a" },
          { label: "东京", lon: 139.6917, lat: 35.6895, color: "#ffffff" },
          { label: "莫斯科", lon: 37.6173, lat: 55.7558, color: "#fecaca" },
        ]}
        cityDotRadius={3.2}
        cityLabelColor="#f8fafc"
        cityLabelStroke="#07111f"
        cityLabelFontSize={13}
        showLabels={true}
        labelNames={world.labelNames}
        labelColor="#f8fafc"
        labelStroke="#07111f"
        labelFontSize={12}
        introFrames={26}
        extraOverlay={({ projection }) => (
          <FrontlineLayer
            projection={projection}
            frontlines={world.frontlines}
            arrows={world.arrows}
          />
        )}
      />

      <div
        style={{
          position: "absolute",
          left: cardLeft,
          bottom: cardBottom,
          width: 540,
          color: "#f8fafc",
          opacity: cardOpacity,
          textShadow: "0 0 24px rgba(0,0,0,0.78)",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 900, color: "#facc15" }}>{current.year}</div>
        <div style={{ marginTop: 4, fontSize: 48, fontWeight: 950, lineHeight: 1.05 }}>
          {current.title}
        </div>
        {current.subtitle ? (
          <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, color: "#bfdbfe", lineHeight: 1.35 }}>
            {current.subtitle}
          </div>
        ) : null}
      </div>

      {showProgressBar ? (
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            top: progressTop,
            height: 4,
            background: "rgba(255,255,255,0.16)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${clampProgress(frame)}%`,
              height: "100%",
              background: "rgba(255,180,80,0.96)",
            }}
          />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
