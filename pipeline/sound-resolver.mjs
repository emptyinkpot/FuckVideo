export function resolveSoundDesign(segment) {
  const kind = segment.visualContract?.kind || segment.semanticCard?.visualNeed?.kind || "fallback";
  const action = segment.semanticCard?.event?.action || "unknown";
  const narrativeRole = segment.semanticCard?.narrativeRole || "";

  if (kind === "document" || kind === "quote" || kind === "telegram" || kind === "newspaper") {
    return {
      ambient: { id: "room_tone", volume: 0.18 },
      fx: [
        { id: kind === "newspaper" ? "newspaper_flip" : "paper_rustle", at: "start", volume: 0.35 },
        { id: kind === "telegram" ? "telegraph" : "pen_underline", at: "highlight", volume: 0.32 },
      ],
      music: { mood: "documentary", intensity: 0.35 },
    };
  }

  if (kind === "explosion" || action === "explode") {
    return {
      fx: [
        { id: "explosion", at: "middle", volume: 0.9 },
        { id: "metal_break", at: "middle", offsetMs: 120, volume: 0.6 },
        { id: "short_silence", at: "end", volume: 1 },
      ],
      music: { mood: "tense", intensity: 0.75 },
    };
  }

  if (kind === "map" || kind === "route") {
    return {
      ambient: { id: "cold_drone", volume: 0.2 },
      fx: [{ id: "map_whoosh", at: "start", volume: 0.3 }],
      music: { mood: "documentary", intensity: 0.45 },
    };
  }

  if (kind === "train" || kind === "ending" || narrativeRole === "ending_reflection") {
    return {
      ambient: { id: "wind", volume: 0.32 },
      fx: [{ id: "distant_train", at: "end", volume: 0.4 }],
      music: { mood: "reflective", intensity: 0.38 },
    };
  }

  if (kind === "crowd") {
    return {
      ambient: { id: "crowd_murmur", volume: 0.24 },
      fx: [],
      music: { mood: "tense", intensity: 0.42 },
    };
  }

  return {
    ambient: { id: "cold_drone", volume: 0.14 },
    fx: [],
    music: { mood: segment.semanticCard?.tone || "documentary", intensity: 0.25 },
  };
}
