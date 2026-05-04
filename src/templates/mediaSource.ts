export const normalizeStaticMediaPath = (src?: string) => {
  const value = String(src || "").trim().replace(/\\/g, "/");

  if (!value) return "";
  if (/^(https?:|blob:|data:)/i.test(value)) return "";
  if (value.startsWith("/")) return "";
  if (value.startsWith("../")) return "";
  if (value.includes("/../")) return "";
  if (value.startsWith("asset-source/")) return "";
  if (value.startsWith(".runtime/")) return "";
  if (value.startsWith("out/")) return "";
  if (value.startsWith("public/")) return value.slice("public/".length);

  return value;
};

export const isLikelyMediaFile = (src?: string) =>
  /\.(aac|flac|m4a|m4v|mov|mp3|mp4|oga|ogg|wav|webm)$/i.test(
    String(src || "").split("?")[0] || "",
  );
