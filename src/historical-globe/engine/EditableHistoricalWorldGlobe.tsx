import {
  geoCentroid,
  geoDistance,
  geoGraticule,
  geoOrthographic,
  geoPath,
  type GeoPermissibleObjects,
  type GeoPath,
  type GeoProjection,
} from "d3-geo";
import { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type HistoricalFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry;
};

type HistoricalFeatureCollection = {
  type: "FeatureCollection";
  features: HistoricalFeature[];
};

export type VectorLine = {
  id: string;
  label: string;
  points: Array<[number, number]>;
  color: string;
  width: number;
  dash?: string;
};

export type CityMarker = {
  label: string;
  lon: number;
  lat: number;
  color: string;
};

export type WorldFeaturePartOverride = {
  featureName: string;
  partIndexes: number[];
  color: string;
};

export type EditableHistoricalGlobeProps = {
  geoJsonSrc: string;
  overlayGeoJsonSrc?: string;
  title: string;
  subtitle: string;
  backgroundColor: string;
  oceanColor: string;
  globeShadowColor: string;
  showGraticule?: boolean;
  graticuleColor: string;
  borderColor: string;
  borderWidth: number;
  coastGlowColor: string;
  loopFrames: number;
  startLongitude: number;
  rotationDegreesPerFrame: number;
  tiltLatitude: number;
  projectionScale: number;
  projectionTranslateX: number;
  projectionTranslateY: number;
  governingField: string;
  regionNameField: string;
  governingAliases: Record<string, string>;
  territoryColorOverrides?: Record<string, string>;
  worldFeaturePartOverrides?: WorldFeaturePartOverride[];
  territoryOverlayOpacity?: number;
  subjectColorOverrides: Record<string, string>;
  hoiFallbackPalette: string[];
  defaultFill: string;
  hatchRegionNames: string[];
  hatchSubjectNames: string[];
  overlayHatchRegionNames?: string[];
  hatchLineColor: string;
  hatchLineWidth: number;
  hatchGap: number;
  hatchOpacity: number;
  hatchAngle: number;
  hatchStrokeColor: string;
  hatchStrokeWidth: number;
  frontLines: VectorLine[];
  terrainLines: VectorLine[];
  cities: CityMarker[];
  cityDotRadius: number;
  cityLabelColor: string;
  cityLabelStroke: string;
  cityLabelFontSize: number;
  showLabels: boolean;
  labelNames: string[];
  labelColor: string;
  labelStroke: string;
  labelFontSize: number;
  introFrames: number;
  extraOverlay?: (ctx: {
    frame: number;
    width: number;
    height: number;
    projection: GeoProjection;
    geoPath: GeoPath<unknown, GeoPermissibleObjects>;
    globeCenter: [number, number];
  }) => React.ReactNode;
};

const valueAsString = (value: unknown): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return "";
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const shiftedHue = hue / 60;
  const x = chroma * (1 - Math.abs((shiftedHue % 2) - 1));
  const base =
    shiftedHue < 1
      ? [chroma, x, 0]
      : shiftedHue < 2
        ? [x, chroma, 0]
        : shiftedHue < 3
          ? [0, chroma, x]
          : shiftedHue < 4
            ? [0, x, chroma]
            : shiftedHue < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const match = normalizedLightness - chroma / 2;

  return `#${base
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

const distinctHoiColor = (key: string, index: number, paletteSize: number) => {
  let hash = 0;
  for (let characterIndex = 0; characterIndex < key.length; characterIndex += 1) {
    hash = (hash * 31 + key.charCodeAt(characterIndex)) >>> 0;
  }

  const hue = (index * 137.508 + (hash % 31)) % 360;
  const paletteOffset = paletteSize > 0 ? index % paletteSize : index;
  const saturation = 40 + ((paletteOffset * 7) % 16);
  const lightness = 42 + ((paletteOffset * 5) % 14);

  return hslToHex(hue, saturation, lightness);
};

const getGovernedName = (
  feature: HistoricalFeature,
  governingField: string,
  regionNameField: string,
  aliases: Record<string, string>,
) => {
  const rawName =
    valueAsString(feature.properties[governingField]) ||
    valueAsString(feature.properties[regionNameField]);

  return aliases[rawName] ?? rawName;
};

const getRegionName = (feature: HistoricalFeature, regionNameField: string) =>
  valueAsString(feature.properties[regionNameField]);

const isPointVisible = (point: [number, number], center: [number, number]) =>
  geoDistance(point, center) < Math.PI / 2;

const lineToFeature = (line: VectorLine): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: "Feature",
  properties: { id: line.id, label: line.label },
  geometry: {
    type: "LineString",
    coordinates: line.points,
  },
});

const reverseOverlayFeature = (feature: HistoricalFeature): HistoricalFeature => {
  const geometry = feature.geometry;

  if (geometry.type === "Polygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) => [...ring].reverse()),
      },
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) =>
          polygon.map((ring) => [...ring].reverse()),
        ),
      },
    };
  }

  return feature;
};

const worldPartKey = (featureName: string, partIndex: number) =>
  `${featureName}::${partIndex}`;

const buildWorldPartOverrideMap = (overrides: WorldFeaturePartOverride[]) => {
  const overrideMap = new Map<string, string>();

  for (const override of overrides) {
    for (const partIndex of override.partIndexes) {
      overrideMap.set(worldPartKey(override.featureName, partIndex), override.color);
    }
  }

  return overrideMap;
};

type RenderableWorldFeature = {
  feature: HistoricalFeature;
  colorOverride?: string;
  keySuffix: string;
};

const splitWorldFeatureByPartOverrides = (
  feature: HistoricalFeature,
  regionNameField: string,
  partOverrides: WorldFeaturePartOverride[],
): RenderableWorldFeature[] => {
  if (partOverrides.length === 0 || feature.geometry.type !== "MultiPolygon") {
    return [{ feature, keySuffix: "base" }];
  }

  const featureName = getRegionName(feature, regionNameField);
  const overrideMap = buildWorldPartOverrideMap(partOverrides);
  const baseCoordinates = feature.geometry.coordinates.filter(
    (_polygon, index) => !overrideMap.has(worldPartKey(featureName, index)),
  );
  const renderables: RenderableWorldFeature[] = [];

  if (baseCoordinates.length > 0) {
    const baseGeometry: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: baseCoordinates,
    };

    renderables.push({
      feature:
        baseCoordinates.length === feature.geometry.coordinates.length
          ? feature
          : {
              ...feature,
              geometry: baseGeometry,
            },
      keySuffix: "base",
    });
  }

  feature.geometry.coordinates.forEach((polygon, index) => {
    const colorOverride = overrideMap.get(worldPartKey(featureName, index));
    if (!colorOverride) {
      return;
    }

    renderables.push({
      feature: {
        ...feature,
        geometry: {
          type: "MultiPolygon",
          coordinates: [polygon],
        },
      },
      colorOverride,
      keySuffix: `part-${index}`,
    });
  });

  if (renderables.length === 0) {
    return [{ feature, keySuffix: "base" }];
  }

  return renderables;
};

const getSafeBounds = (
  bounds: [[number, number], [number, number]] | null | undefined,
): [[number, number], [number, number]] | null => {
  if (
    !Array.isArray(bounds) ||
    !Array.isArray(bounds[0]) ||
    !Array.isArray(bounds[1]) ||
    bounds[0].length < 2 ||
    bounds[1].length < 2
  ) {
    return null;
  }

  const normalizedBounds: [[number, number], [number, number]] = [
    [bounds[0][0], bounds[0][1]],
    [bounds[1][0], bounds[1][1]],
  ];

  const [[minX, minY], [maxX, maxY]] = normalizedBounds;
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  if (maxX <= minX || maxY <= minY) {
    return null;
  }

  return normalizedBounds;
};

const HatchClippedRegion = ({
  id,
  pathData,
  bounds,
  lineColor,
  lineWidth,
  gap,
  opacity,
  angle,
  strokeColor,
  strokeWidth,
}: {
  id: string;
  pathData: string;
  bounds: [[number, number], [number, number]];
  lineColor: string;
  lineWidth: number;
  gap: number;
  opacity: number;
  angle: number;
  strokeColor: string;
  strokeWidth: number;
}) => {
  const safeBounds = getSafeBounds(bounds);
  if (!safeBounds) {
    return null;
  }

  const [[minX, minY], [maxX, maxY]] = safeBounds;
  const padding = gap * 2;
  const lineCount = Math.ceil((maxY - minY + padding * 2) / gap) + 1;
  const lines = Array.from({ length: lineCount }, (_, index) => minY - padding + index * gap);
  const centerX = minX + (maxX - minX) / 2;
  const centerY = minY + (maxY - minY) / 2;

  return (
    <g>
      <defs>
        <clipPath id={id} clipPathUnits="userSpaceOnUse">
          <path d={pathData} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`} opacity={opacity} transform={`rotate(${angle} ${centerX} ${centerY})`}>
        {lines.map((y) => (
          <line
            key={y}
            x1={minX - padding}
            y1={y}
            x2={maxX + padding}
            y2={y}
            stroke={lineColor}
            strokeWidth={lineWidth}
            strokeDasharray={`${gap} ${gap}`}
          />
        ))}
      </g>
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  );
};

export const EditableHistoricalWorldGlobe = ({
  geoJsonSrc,
  overlayGeoJsonSrc,
  title,
  subtitle,
  backgroundColor,
  oceanColor,
  globeShadowColor,
  showGraticule = true,
  graticuleColor,
  borderColor,
  borderWidth,
  coastGlowColor,
  loopFrames,
  startLongitude,
  rotationDegreesPerFrame,
  tiltLatitude,
  projectionScale,
  projectionTranslateX,
  projectionTranslateY,
  governingField,
  regionNameField,
  governingAliases,
  territoryColorOverrides = {},
  worldFeaturePartOverrides = [],
  territoryOverlayOpacity = 0.96,
  subjectColorOverrides,
  hoiFallbackPalette,
  defaultFill,
  hatchRegionNames,
  hatchSubjectNames,
  overlayHatchRegionNames = [],
  hatchLineColor,
  hatchLineWidth,
  hatchGap,
  hatchOpacity,
  hatchAngle,
  hatchStrokeColor,
  hatchStrokeWidth,
  frontLines,
  terrainLines,
  cities,
  cityDotRadius,
  cityLabelColor,
  cityLabelStroke,
  cityLabelFontSize,
  showLabels,
  labelNames,
  labelColor,
  labelStroke,
  labelFontSize,
  introFrames,
  extraOverlay,
}: EditableHistoricalGlobeProps) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const [data, setData] = useState<HistoricalFeatureCollection | null>(null);
  const [overlayData, setOverlayData] = useState<HistoricalFeatureCollection | null>(null);

  useEffect(() => {
    fetch(staticFile(geoJsonSrc))
      .then((response) => response.json())
      .then((json) => setData(json as HistoricalFeatureCollection));
  }, [geoJsonSrc]);

  useEffect(() => {
    if (!overlayGeoJsonSrc) {
      setOverlayData(null);
      return;
    }

    fetch(staticFile(overlayGeoJsonSrc))
      .then((response) => response.json())
      .then((json) => setOverlayData(json as HistoricalFeatureCollection));
  }, [overlayGeoJsonSrc]);

  const rotationLongitude = startLongitude + (frame % loopFrames) * rotationDegreesPerFrame;
  const globeCenter: [number, number] = [-rotationLongitude, -tiltLatitude];

  const projection = useMemo<GeoProjection>(() => {
    return geoOrthographic()
      .scale(projectionScale)
      .translate([width / 2 + projectionTranslateX, height / 2 + projectionTranslateY])
      .rotate([rotationLongitude, tiltLatitude, 0])
      .clipAngle(90);
  }, [
    height,
    projectionScale,
    projectionTranslateX,
    projectionTranslateY,
    rotationLongitude,
    tiltLatitude,
    width,
  ]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const graticulePath = useMemo(() => path(geoGraticule().step([20, 20])()) ?? "", [path]);

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

  const shouldHatch = (feature: HistoricalFeature) => {
    const regionName = getRegionName(feature, regionNameField);
    const governedName = getGovernedName(feature, governingField, regionNameField, governingAliases);
    return hatchRegionNames.includes(regionName) || hatchSubjectNames.includes(governedName);
  };

  const subjectColorMap = useMemo(() => {
    if (!data) {
      return new Map<string, string>();
    }

    const governedNames = Array.from(
      new Set(
        data.features
          .map((feature) =>
            getGovernedName(feature, governingField, regionNameField, governingAliases),
          )
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return new Map(
      governedNames.map((name, index) => [
        name,
        subjectColorOverrides[name] ??
          distinctHoiColor(name, index, Math.max(hoiFallbackPalette.length, 1)),
      ]),
    );
  }, [
    data,
    governingAliases,
    governingField,
    hoiFallbackPalette.length,
    regionNameField,
    subjectColorOverrides,
  ]);

  const fillForFeature = (feature: HistoricalFeature) => {
    const regionName = getRegionName(feature, regionNameField);
    const governedName = getGovernedName(feature, governingField, regionNameField, governingAliases);
    const territoryOverride = territoryColorOverrides[regionName] ?? territoryColorOverrides[governedName];
    if (territoryOverride) {
      return territoryOverride;
    }

    return subjectColorMap.get(governedName) ?? defaultFill;
  };

  const fillForOverlayFeature = (feature: HistoricalFeature) => {
    const overlayName =
      valueAsString(feature.properties.name) ||
      valueAsString(feature.properties.NAME);

    return overlayName ? territoryColorOverrides[overlayName] : undefined;
  };

  const labelFeatures = useMemo(() => {
    if (!data) {
      return [];
    }

    const seen = new Set<string>();
    return data.features.filter((feature) => {
      const regionName = getRegionName(feature, regionNameField);
      const governedName = getGovernedName(feature, governingField, regionNameField, governingAliases);
      const labelKey = labelNames.includes(regionName) ? regionName : governedName;

      if (!labelNames.includes(labelKey) || seen.has(labelKey)) {
        return false;
      }

      seen.add(labelKey);
      return true;
    });
  }, [data, governingAliases, governingField, labelNames, regionNameField]);

  const renderVectorLine = (line: VectorLine, opacity: number) => {
    const linePath = path(lineToFeature(line));
    if (!linePath) {
      return null;
    }

    return (
      <path
        key={line.id}
        d={linePath}
        fill="none"
        stroke={line.color}
        strokeWidth={line.width}
        strokeDasharray={line.dash}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, #102a42, ${backgroundColor} 72%)`,
        overflow: "hidden",
        fontFamily: "Inter, Microsoft YaHei, Arial, sans-serif",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: "absolute",
          inset: 0,
          opacity: intro,
        }}
      >
        <defs>
          <radialGradient id="vector-globe-ocean" cx="38%" cy="32%" r="66%">
            <stop offset="0%" stopColor="#2c6385" />
            <stop offset="52%" stopColor={oceanColor} />
            <stop offset="100%" stopColor="#061523" />
          </radialGradient>
          <radialGradient id="vector-globe-light" cx="35%" cy="25%" r="72%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="52%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor={globeShadowColor} />
          </radialGradient>
        </defs>

        <circle
          cx={width / 2 + projectionTranslateX}
          cy={height / 2 + projectionTranslateY}
          r={projectionScale}
          fill="url(#vector-globe-ocean)"
          filter="drop-shadow(0 26px 54px rgba(0,0,0,0.52))"
        />
        {showGraticule ? (
          <path d={graticulePath} fill="none" stroke={graticuleColor} strokeWidth={0.7} />
        ) : null}

        {data
          ? data.features.flatMap((feature, index) => {
              const renderables = splitWorldFeatureByPartOverrides(
                feature,
                regionNameField,
                worldFeaturePartOverrides,
              );

              return renderables.map((renderable) => {
                const pathData = path(renderable.feature as unknown as GeoJSON.Feature) ?? "";
                if (!pathData) {
                  return null;
                }

                const regionName =
                  getRegionName(renderable.feature, regionNameField) || `region-${index}`;

                return (
                  <path
                    key={`${regionName}-${renderable.keySuffix}-${index}`}
                    d={pathData}
                    fill={renderable.colorOverride ?? fillForFeature(renderable.feature)}
                    stroke={borderColor}
                    strokeWidth={borderWidth}
                    strokeLinejoin="round"
                  />
                );
              });
            })
          : null}

        {terrainLines.map((line) => renderVectorLine(line, 0.75))}

        {overlayData
          ? overlayData.features.map((feature, index) => {
              const overlayFill = fillForOverlayFeature(feature);
              if (!overlayFill) {
                return null;
              }

              const overlayName =
                valueAsString(feature.properties.name) ||
                valueAsString(feature.properties.NAME) ||
                `overlay-fill-${index}`;
              const correctedFeature = reverseOverlayFeature(feature);
              const pathData = path(correctedFeature as unknown as GeoJSON.Feature) ?? "";
              if (!pathData) {
                return null;
              }

              return (
                <path
                  key={`${overlayName}-territory-fill-${index}`}
                  d={pathData}
                  fill={overlayFill}
                  stroke={borderColor}
                  strokeWidth={borderWidth * 0.9}
                  strokeLinejoin="round"
                  opacity={territoryOverlayOpacity}
                />
              );
            })
          : null}

        {data
          ? data.features.map((feature, index) => {
              if (!shouldHatch(feature)) {
                return null;
              }

              const pathData = path(feature as unknown as GeoJSON.Feature) ?? "";
              if (!pathData) {
                return null;
              }

              const regionName = getRegionName(feature, regionNameField) || `hatch-${index}`;

              return (
                <HatchClippedRegion
                  key={`${regionName}-hatch-${index}`}
                  id={`world-hatch-${index}`}
                  pathData={pathData}
                  bounds={path.bounds(feature as unknown as GeoJSON.Feature)}
                  lineColor={hatchLineColor}
                  lineWidth={hatchLineWidth}
                  gap={hatchGap}
                  opacity={hatchOpacity}
                  angle={hatchAngle}
                  strokeColor={hatchStrokeColor}
                  strokeWidth={hatchStrokeWidth}
                />
              );
            })
          : null}

        {overlayData
          ? overlayData.features.map((feature, index) => {
              const overlayName =
                valueAsString(feature.properties.name) ||
                valueAsString(feature.properties.NAME) ||
                `overlay-${index}`;

              if (!overlayHatchRegionNames.includes(overlayName)) {
                return null;
              }

              const correctedFeature = reverseOverlayFeature(feature);
              const pathData = path(correctedFeature as unknown as GeoJSON.Feature) ?? "";
              if (!pathData) {
                return null;
              }

              return (
                <HatchClippedRegion
                  key={`${overlayName}-province-hatch-${index}`}
                  id={`overlay-hatch-${index}`}
                  pathData={pathData}
                  bounds={path.bounds(correctedFeature as unknown as GeoJSON.Feature)}
                  lineColor={hatchLineColor}
                  lineWidth={hatchLineWidth}
                  gap={hatchGap}
                  opacity={hatchOpacity}
                  angle={hatchAngle}
                  strokeColor={hatchStrokeColor}
                  strokeWidth={hatchStrokeWidth}
                />
              );
            })
          : null}

        {frontLines.map((line) => renderVectorLine(line, 0.9))}

        {extraOverlay?.({
          frame,
          width,
          height,
          projection,
          geoPath: path,
          globeCenter,
        })}

        <circle
          cx={width / 2 + projectionTranslateX}
          cy={height / 2 + projectionTranslateY}
          r={projectionScale}
          fill="url(#vector-globe-light)"
          pointerEvents="none"
        />
        <circle
          cx={width / 2 + projectionTranslateX}
          cy={height / 2 + projectionTranslateY}
          r={projectionScale}
          fill="none"
          stroke={coastGlowColor}
          strokeWidth={2.2}
        />

        {cities.map((city) => {
          if (!isPointVisible([city.lon, city.lat], globeCenter)) {
            return null;
          }

          const projected = projection([city.lon, city.lat]);
          if (!projected) {
            return null;
          }

          return (
            <g key={city.label}>
              <circle
                cx={projected[0]}
                cy={projected[1]}
                r={cityDotRadius}
                fill={city.color}
                stroke="#07111f"
                strokeWidth={1.4}
              />
              <text
                x={projected[0] + 8}
                y={projected[1] - 8}
                fontSize={cityLabelFontSize}
                fontWeight={800}
                fill={cityLabelColor}
                stroke={cityLabelStroke}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {city.label}
              </text>
            </g>
          );
        })}

        {showLabels
          ? labelFeatures.map((feature, index) => {
              const centroid = geoCentroid(feature as unknown as GeoJSON.Feature) as [number, number];
              if (!isPointVisible(centroid, globeCenter)) {
                return null;
              }

              const projected = projection(centroid);
              if (!projected) {
                return null;
              }

              const regionName = getRegionName(feature, regionNameField);
              const governedName = getGovernedName(
                feature,
                governingField,
                regionNameField,
                governingAliases,
              );
              const label = labelNames.includes(regionName) ? regionName : governedName;

              return (
                <text
                  key={`${label}-label-${index}`}
                  x={projected[0]}
                  y={projected[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelFontSize}
                  fontWeight={900}
                  fill={labelColor}
                  stroke={labelStroke}
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {label}
                </text>
              );
            })
          : null}
      </svg>

      <div
        style={{
          position: "absolute",
          left: 58,
          top: 48,
          color: "#f8fafc",
          opacity: titleOpacity,
          textShadow: "0 0 24px rgba(0,0,0,0.72)",
        }}
      >
        <div style={{ fontSize: 45, fontWeight: 950, lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800, color: "#bfdbfe" }}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
