import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const CATEGORY_PAGES = [
  "https://mixkit.co/free-after-effects-templates/reveal/",
  "https://mixkit.co/free-after-effects-templates/reveal/?page=2",
];

const OUT_ROOT = "asset-source/mixkit-reveal";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const ensureDir = (dir) => mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });

async function fetchText(url, referer) {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      ...(referer ? { referer } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.text();
}

async function downloadFile(url, outPath, referer) {
  if (!url) return false;
  const full = path.resolve(process.cwd(), outPath);
  if (existsSync(full)) return true;
  ensureDir(path.dirname(outPath));
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      ...(referer ? { referer } : {}),
    },
  });
  if (!res.ok) throw new Error(`Download ${url} failed: ${res.status}`);
  await pipeline(res.body, createWriteStream(full));
  return true;
}

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function detailLinksFromCategory(html) {
  const links = [];
  const re = /href="(\/free-after-effects-templates\/[^"]+?)"/g;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1].split("?")[0];
    if (/-\d+\/$/.test(href)) {
      links.push(`https://mixkit.co${href}`);
    }
  }
  return uniq(links);
}

function cleanTitle(raw) {
  return decodeHtml(raw || "")
    .replace(/\s+-\s+Free After Effects Template\s+\|\s+Mixkit\s*$/i, "")
    .replace(/\s+\|\s+Mixkit\s*$/i, "")
    .trim();
}

function slugFromUrl(url) {
  return new URL(url).pathname.split("/").filter(Boolean).at(-1) || "";
}

function tagsFromHtml(html) {
  const tags = [];
  const re = /href="\/free-after-effects-templates\/([^"\/]+)\/"/g;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[1];
    if (!/^\d+$/.test(tag) && !tag.includes("?")) tags.push(tag);
  }
  return uniq(tags)
    .filter((tag) => !["reveal"].includes(tag))
    .slice(0, 12);
}

function inferEffectKind(title, slug, tags) {
  const value = `${title} ${slug}`.toLowerCase();
  const tagValue = tags.join(" ").toLowerCase();
  if (/lower|third|box/.test(value)) return "lowerThird";
  if (/bar|transition|text/.test(value)) return "barText";
  if (/news/.test(value)) return "news";
  if (/pixel|frame/.test(value)) return "pixelFrame";
  if (/3d/.test(value)) return "threeD";
  if (/splash|liquid|water/.test(value)) return "splash";
  if (/swirl|twist/.test(value)) return "swirl";
  if (/neon/.test(value)) return "neon";
  if (/glitch/.test(value)) return "glitch";
  if (/radial|wipe/.test(value)) return "radialWipe";
  if (/music|visualizer|audio/.test(value)) return "audioVisualizer";
  if (/gaming|shape/.test(value)) return "gaming";
  if (/sport/.test(value)) return "sport";
  if (/birthday|confetti/.test(value)) return "confetti";
  if (/firework|new-year/.test(value)) return "fireworks";
  if (/christmas|snow|seasonal/.test(value)) return "seasonal";
  if (/smoke|particle/.test(value)) return "particles";
  if (/food/.test(value)) return "food";
  if (/corporate|swipe|company|promo|clean/.test(value)) return "corporate";
  if (/transition|titles/.test(tagValue)) return "barText";
  return "logoReveal";
}

function extractMeta(html, url) {
  const slug = slugFromUrl(url);
  const id = Number(slug.match(/-(\d+)$/)?.[1]);
  const title = cleanTitle(html.match(/<title>([^<]+)<\/title>/i)?.[1]);
  const description = decodeHtml(
    html.match(/<meta name="description" content="([^"]+)"/i)?.[1] || "",
  );
  const posterUrl = decodeHtml(
    html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] || "",
  );
  const previewUrl = decodeHtml(
    html.match(/src="(https:\/\/assets\.mixkit\.co\/video-templates\/\d+\/mixkit-\d+-360\.mp4)"/i)?.[1] ||
      "",
  );
  const modalPath = decodeHtml(
    html.match(/data-download--button-modal-url-value="([^"]+)"/i)?.[1] || "",
  );
  const tags = tagsFromHtml(html);
  return {
    id,
    slug,
    title,
    description,
    sourceUrl: url,
    posterUrl,
    previewUrl,
    modalUrl: modalPath ? `https://mixkit.co${modalPath}` : "",
    tags,
    effectKind: inferEffectKind(title, slug, tags),
  };
}

async function resolveDownloadUrl(item) {
  if (!item.modalUrl) return "";
  const html = await fetchText(item.modalUrl, item.sourceUrl);
  return decodeHtml(
    html.match(/data-download--modal-url-value="([^"]+)"/i)?.[1] || "",
  );
}

async function main() {
  ensureDir(OUT_ROOT);
  ensureDir(`${OUT_ROOT}/originals`);
  ensureDir(`${OUT_ROOT}/previews`);
  ensureDir(`${OUT_ROOT}/posters`);

  const detailLinks = [];
  for (const page of CATEGORY_PAGES) {
    const html = await fetchText(page);
    detailLinks.push(...detailLinksFromCategory(html));
  }
  const links = uniq(detailLinks);
  if (links.length !== 26) {
    throw new Error(`Expected 26 reveal templates, got ${links.length}`);
  }

  const items = [];
  for (const url of links) {
    const html = await fetchText(url);
    const item = extractMeta(html, url);
    item.downloadUrl = await resolveDownloadUrl(item);
    item.localZip = `${OUT_ROOT}/originals/mixkit-${item.id}-${item.slug}.zip`;
    item.localPreview = item.previewUrl
      ? `${OUT_ROOT}/previews/mixkit-${item.id}-360.mp4`
      : "";
    item.localPoster = item.posterUrl
      ? `${OUT_ROOT}/posters/mixkit-${item.id}-poster.jpg`
      : "";

    await downloadFile(item.downloadUrl, item.localZip, item.sourceUrl);
    await downloadFile(item.previewUrl, item.localPreview, item.sourceUrl);
    await downloadFile(item.posterUrl, item.localPoster, item.sourceUrl);
    items.push(item);
    console.log(`imported ${item.id}: ${item.title}`);
  }

  const manifest = {
    source: "https://mixkit.co/free-after-effects-templates/reveal/",
    importedAt: new Date().toISOString(),
    license: {
      name: "Mixkit Video Templates Free License",
      url: "https://mixkit.co/license/#videoTemplateFree",
      note:
        "Mixkit states these video templates can be used in commercial and non-commercial projects for free; keep raw downloads as source assets, not runtime-required app code.",
    },
    count: items.length,
    items,
  };
  writeFileSync(
    path.resolve(process.cwd(), `${OUT_ROOT}/manifest.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
