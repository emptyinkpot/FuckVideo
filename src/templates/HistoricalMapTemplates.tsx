import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

type HistoricalYear = 1880 | 1938 | 1945 | 2010;

export type HistoricalCountryMapProps = {
  year?: HistoricalYear;
  title?: string;
  subtitle?: string;
  mapScale?: number;
  mapTranslateX?: number;
  mapTranslateY?: number;
  mapRotation?: number;
  backgroundColor?: string;
  paperColor?: string;
  imageOpacity?: number;
  imageContrast?: number;
  imageSaturate?: number;
  showYearBadge?: boolean;
  showSourceNote?: boolean;
  focusLabels?: Array<{
    label: string;
    x: number;
    y: number;
    color?: string;
    startFrame?: number;
  }>;
};

const yearToFile: Record<HistoricalYear, string> = {
  1880: "historical-maps/world_1880.svg",
  1938: "historical-maps/world_1938.svg",
  1945: "historical-maps/world_1945.svg",
  2010: "historical-maps/world_2010.svg",
};

const defaultLabels = [
  { label: "欧洲", x: 655, y: 276, color: "#f97316", startFrame: 42 },
  { label: "非洲", x: 650, y: 430, color: "#22c55e", startFrame: 68 },
  { label: "亚洲", x: 840, y: 325, color: "#38bdf8", startFrame: 94 },
];

export const HistoricalCountryMap = ({
  year = 1938,
  title = "历史国家地图",
  subtitle = "国家与文化区域边界来自 historical-basemaps",
  mapScale = 1.18,
  mapTranslateX = 0,
  mapTranslateY = -8,
  mapRotation = 0,
  backgroundColor = "#111827",
  paperColor = "#f8f2df",
  imageOpacity = 0.94,
  imageContrast = 1.06,
  imageSaturate = 0.88,
  showYearBadge = true,
  showSourceNote = true,
  focusLabels = defaultLabels,
}: HistoricalCountryMapProps) => {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const camera = interpolate(frame, [0, 260], [1.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, ${paperColor}, ${backgroundColor} 76%)`,
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 42,
          borderRadius: 12,
          background: paperColor,
          boxShadow: "0 34px 90px rgba(0,0,0,0.34)",
          overflow: "hidden",
          opacity: intro,
        }}
      >
        <Img
          src={staticFile(yearToFile[year])}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 1180,
            height: 786,
            objectFit: "contain",
            opacity: imageOpacity,
            filter: `contrast(${imageContrast}) saturate(${imageSaturate})`,
            transform: `translate(-50%, -50%) translate(${mapTranslateX}px, ${mapTranslateY}px) rotate(${mapRotation}deg) scale(${mapScale * camera})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(248,242,223,0.4), transparent 22%, transparent 78%, rgba(248,242,223,0.5))",
            pointerEvents: "none",
          }}
        />
        {focusLabels.map((item) => {
          const opacity = interpolate(frame, [item.startFrame ?? 40, (item.startFrame ?? 40) + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={item.label}
              style={{
                position: "absolute",
                left: item.x,
                top: item.y,
                color: item.color ?? "#f97316",
                opacity,
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: item.color ?? "#f97316",
                  boxShadow: `0 0 22px ${item.color ?? "#f97316"}`,
                  margin: "0 auto 8px",
                }}
              />
              <div
                style={{
                  color: "#111827",
                  fontSize: 24,
                  fontWeight: 900,
                  textShadow: "0 1px 0 rgba(255,255,255,0.8)",
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 74,
          top: 62,
          color: "#111827",
          opacity: intro,
        }}
      >
        <div style={{ fontSize: 50, fontWeight: 900, lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800, color: "#374151" }}>
          {subtitle}
        </div>
      </div>
      {showYearBadge ? (
        <div
          style={{
            position: "absolute",
            right: 78,
            top: 62,
            color: "#f8f2df",
            background: "#111827",
            borderRadius: 8,
            padding: "14px 22px",
            fontSize: 34,
            fontWeight: 900,
            opacity: intro,
            boxShadow: "0 16px 34px rgba(0,0,0,0.3)",
          }}
        >
          {year}
        </div>
      ) : null}
      {showSourceNote ? (
        <div
          style={{
            position: "absolute",
            left: 74,
            bottom: 34,
            color: "#f8f2df",
            fontSize: 15,
            fontWeight: 700,
            opacity: 0.72,
          }}
        >
          来源：historical-basemaps，GPL-3.0。历史边界仅作近似展示，部分边界存在争议。
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
