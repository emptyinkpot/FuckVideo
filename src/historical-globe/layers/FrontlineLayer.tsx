import type { GeoProjection } from "d3-geo";
import { interpolate, useCurrentFrame } from "remotion";
import type { AttackArrow, Frontline } from "../data/sino-japanese-war.timeline";

type FrontlineLayerProps = {
  projection: GeoProjection;
  frontlines?: Frontline[];
  arrows?: AttackArrow[];
};

const projectLine = (projection: GeoProjection, points: Array<[number, number]>) => {
  const projected = points
    .map((point) => projection(point))
    .filter((point): point is [number, number] => Boolean(point));

  if (projected.length < 2) {
    return "";
  }

  return projected
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
};

export const FrontlineLayer = ({
  projection,
  frontlines = [],
  arrows = [],
}: FrontlineLayerProps) => {
  const frame = useCurrentFrame();
  const dashOffset = -frame * 2;
  const pulse = 0.78 + Math.sin(frame * 0.16) * 0.22;
  const reveal = interpolate(frame % 75, [0, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <g>
      {frontlines.map((frontline) => {
        const pathData = projectLine(projection, frontline.points);
        if (!pathData) {
          return null;
        }
        const opacity = (frontline.opacity ?? 1) * pulse;

        return (
          <g key={frontline.name} opacity={opacity}>
            <path
              d={pathData}
              fill="none"
              stroke="rgba(255,45,45,0.95)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="10 8"
              strokeDashoffset={dashOffset}
              style={{ filter: "drop-shadow(0 0 8px rgba(255,45,45,0.95))" }}
            />
            <path
              d={pathData}
              fill="none"
              stroke="rgba(255,235,180,0.85)"
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {arrows.map((arrow, index) => {
        const from = projection(arrow.from);
        const to = projection(arrow.to);
        if (!from || !to) {
          return null;
        }
        const opacity = arrow.opacity ?? 1;

        const [x1, y1] = from;
        const [x2, y2] = to;
        const tx = x1 + (x2 - x1) * reveal;
        const ty = y1 + (y2 - y1) * reveal;

        return (
          <g key={`${arrow.label ?? "arrow"}-${index}`} opacity={opacity}>
            <line
              x1={x1}
              y1={y1}
              x2={tx}
              y2={ty}
              stroke="rgba(255,190,80,0.96)"
              strokeWidth={3.2}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 9px rgba(255,150,40,0.9))" }}
            />
            <circle cx={tx} cy={ty} r={5.2} fill="rgba(255,235,150,1)" />
            {arrow.label ? (
              <text
                x={tx + 8}
                y={ty - 8}
                fill="rgba(255,235,190,0.96)"
                stroke="#07111f"
                strokeWidth={3}
                paintOrder="stroke"
                fontSize={16}
                fontWeight={800}
              >
                {arrow.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};
