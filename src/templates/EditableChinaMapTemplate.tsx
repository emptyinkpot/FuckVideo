import { geoMercator, geoPath } from "d3-geo";
import { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

type GeoJsonFeature = {
  type: "Feature";
  properties: {
    name?: string;
    adcode?: number;
    center?: [number, number];
    centroid?: [number, number];
    [key: string]: unknown;
  };
  geometry: GeoJSON.Geometry;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

export type EditableChinaProvinceMapProps = {
  geoJsonSrc: string;
  title: string;
  subtitle: string;
  backgroundColor: string;
  seaColor: string;
  defaultFill: string;
  defaultStroke: string;
  defaultStrokeWidth: number;
  regionColors: Record<string, string>;
  highlightRegions: string[];
  highlightColor: string;
  highlightStrokeWidth: number;
  hatchLineColor: string;
  hatchLineWidth: number;
  hatchGap: number;
  hatchOpacity: number;
  hatchAngle: number;
  showLabels: boolean;
  labelColor: string;
  labelStroke: string;
  labelFontSize: number;
  mapScale: number;
  mapTranslateX: number;
  mapTranslateY: number;
  introFrames: number;
};

export const EditableChinaProvinceMap = ({
  geoJsonSrc,
  title,
  subtitle,
  backgroundColor,
  seaColor,
  defaultFill,
  defaultStroke,
  defaultStrokeWidth,
  regionColors,
  highlightRegions,
  highlightColor,
  highlightStrokeWidth,
  hatchLineColor,
  hatchLineWidth,
  hatchGap,
  hatchOpacity,
  hatchAngle,
  showLabels,
  labelColor,
  labelStroke,
  labelFontSize,
  mapScale,
  mapTranslateX,
  mapTranslateY,
  introFrames,
}: EditableChinaProvinceMapProps) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const [data, setData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch(staticFile(geoJsonSrc))
      .then((response) => response.json())
      .then((json) => setData(json as FeatureCollection));
  }, [geoJsonSrc]);

  const projectionAndPath = useMemo(() => {
    if (!data) {
      return null;
    }

    const projection = geoMercator().fitExtent(
      [
        [90, 86],
        [width - 90, height - 70],
      ],
      data as unknown as GeoJSON.FeatureCollection,
    );
    const path = geoPath(projection);
    return { projection, path };
  }, [data, height, width]);

  const intro = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 120 },
    durationInFrames: introFrames,
  });
  const titleOpacity = interpolate(frame, [8, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, ${seaColor}, ${backgroundColor} 72%)`,
        overflow: "hidden",
        fontFamily: "Inter, Microsoft YaHei, Arial, sans-serif",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${mapTranslateX}px, ${mapTranslateY}px) scale(${mapScale})`,
          transformOrigin: "50% 52%",
          opacity: intro,
        }}
      >
        <defs>
          <pattern
            id="disputed-hatch"
            width={hatchGap * 2}
            height={hatchGap * 2}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${hatchAngle})`}
          >
            <line
              x1="0"
              y1={hatchGap}
              x2={hatchGap * 2}
              y2={hatchGap}
              stroke={hatchLineColor}
              strokeWidth={hatchLineWidth}
              strokeDasharray={`${hatchGap} ${hatchGap}`}
              opacity={hatchOpacity}
            />
          </pattern>
        </defs>
        {data && projectionAndPath
          ? data.features.map((feature, index) => {
              const name = feature.properties.name ?? `region-${index}`;
              const isHighlighted = highlightRegions.includes(name);
              const pathData = projectionAndPath.path(feature as unknown as GeoJSON.Feature) ?? "";
              const fill = regionColors[name] ?? defaultFill;

              return (
                <path
                  key={`${name}-${feature.properties.adcode ?? index}`}
                  d={pathData}
                  fill={fill}
                  stroke={isHighlighted ? highlightColor : defaultStroke}
                  strokeWidth={isHighlighted ? highlightStrokeWidth : defaultStrokeWidth}
                  strokeLinejoin="round"
                  style={{
                    filter: isHighlighted ? `drop-shadow(0 0 10px ${highlightColor})` : "none",
                  }}
                />
              );
            })
          : null}
        {data && projectionAndPath
          ? data.features.map((feature, index) => {
              const name = feature.properties.name ?? `region-${index}`;
              if (!highlightRegions.includes(name)) {
                return null;
              }
              const pathData = projectionAndPath.path(feature as unknown as GeoJSON.Feature) ?? "";

              return (
                <path
                  key={`${name}-hatch-${feature.properties.adcode ?? index}`}
                  d={pathData}
                  fill="url(#disputed-hatch)"
                  stroke={highlightColor}
                  strokeWidth={highlightStrokeWidth}
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 10px ${highlightColor})` }}
                />
              );
            })
          : null}
        {showLabels && data && projectionAndPath
          ? data.features.map((feature, index) => {
              const name = feature.properties.name ?? "";
              const center = feature.properties.centroid ?? feature.properties.center;
              if (!name || !center) {
                return null;
              }
              const projected = projectionAndPath.projection(center);
              if (!projected) {
                return null;
              }

              return (
                <text
                  key={`${name}-label-${index}`}
                  x={projected[0]}
                  y={projected[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelFontSize}
                  fontWeight={800}
                  fill={labelColor}
                  stroke={labelStroke}
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {name.replace("特别行政区", "").replace("自治区", "").replace("省", "").replace("市", "")}
                </text>
              );
            })
          : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 62,
          top: 52,
          color: "#f8fafc",
          opacity: titleOpacity,
          textShadow: "0 0 24px rgba(0,0,0,0.65)",
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800, color: "#bfdbfe" }}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
