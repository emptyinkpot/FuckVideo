import type { EarthLayer } from "./types";

export type Place = { name: string; lon: number; lat: number };

export type PlaceLabelsLayerOptions = {
  id: string;
  places: Place[];
  /** city：带圆点的城市名；region：较大的国家、地区名 */
  style?: "city" | "region";
  opacity?: number;
  order?: number;
};

/** 地名图层：HTML 文字放在三维位置的投影处，地球背面和画面边缘的不显示。 */
export const placeLabelsLayer = ({
  id,
  places,
  style = "city",
  opacity = 1,
  order = 40,
}: PlaceLabelsLayerOptions): EarthLayer => ({
  id,
  order,
  opacity,
  labels: (project) =>
    places.map((place) => {
      const at = project(place.lon, place.lat);
      if (!at) return null;
      if (style === "region") {
        return (
          <div
            key={place.name}
            style={{
              position: "absolute",
              left: at.x,
              top: at.y,
              transform: "translate(-50%, -50%)",
              color: "rgba(255,255,255,0.92)",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 4,
              textShadow: "0 0 6px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6)",
              whiteSpace: "nowrap",
            }}
          >
            {place.name}
          </div>
        );
      }
      return (
        <div
          key={place.name}
          style={{
            position: "absolute",
            left: at.x,
            top: at.y,
            display: "flex",
            alignItems: "center",
            gap: 6,
            transform: "translate(-5px, -50%)",
            color: "#fff8e6",
            fontSize: 17,
            fontWeight: 700,
            textShadow: "0 0 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{ width: 9, height: 9, borderRadius: 9, background: "#fde68a", boxShadow: "0 0 0 2px rgba(0,0,0,0.6)" }}
          />
          {place.name}
        </div>
      );
    }),
});
