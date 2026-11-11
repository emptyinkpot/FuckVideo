const DEFAULT_TIMEOUT_MS = 5000;

export async function searchMaterialVectors(query, options = {}) {
  const baseUrl = String(options.baseUrl || process.env.MATERIAL_VECTOR_SEARCH_URL || "").replace(/\/$/, "");
  if (!baseUrl || !query) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));

  try {
    const response = await fetch(`${baseUrl}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        assetTypes: options.assetTypes || ["footage"],
        limit: Math.max(1, Math.min(50, Number(options.limit || 8))),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload.matches) ? payload.matches : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export function vectorMatchToAsset(match) {
  return {
    id: match.assetId || match.clipId || match.path,
    providerType: match.assetType === "static" ? "static" : "footage",
    type: match.assetType || "footage",
    path: match.path,
    title: match.metadata?.title || match.assetId || match.path,
    kind: match.metadata?.kind || "",
    description: match.metadata?.description || "",
    tags: match.metadata?.tags || [],
    bestFor: match.metadata?.bestFor || [],
    avoidFor: match.metadata?.avoidFor || [],
    semantic: {
      kind: match.metadata?.kind || "",
      visualKinds: match.metadata?.visualKinds || [],
      entities: match.metadata?.entities || [],
      visualObjects: match.metadata?.visualObjects || [],
      actions: match.metadata?.actions || [],
      location: match.metadata?.location || [],
    },
    retrieval: {
      vectorStore: "material-vector-search",
      score: match.score,
      clipId: match.clipId || "",
      startMs: match.startMs,
      endMs: match.endMs,
    },
  };
}
