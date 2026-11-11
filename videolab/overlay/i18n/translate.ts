// Optional Chinese UI for Remotion Studio (toggle in the workbench card).
//
// Remotion Studio has no i18n API, so this is the one part of the extension that edits Studio's
// page. It is deliberately narrow and reversible:
//   - only whole-text matches against STUDIO_ZH are replaced, in text nodes and in the
//     title / aria-label / placeholder attributes;
//   - input/textarea/select values, contenteditable areas and code are never touched, so prop
//     values typed into the schema panel can't be altered;
//   - the composition preview is skipped, and so is the workbench itself;
//   - nothing is moved or restyled; turning it off restores every original string.
// Renders never load this (they don't run in the Studio page).

import { STUDIO_ZH } from "./dict";

const ATTRS = ["title", "aria-label", "placeholder"] as const;
// Preview containers (Studio implementation detail; if they get renamed, preview text that
// happens to equal a dictionary entry could be translated on screen, never in rendered output).
const SKIP = "#remotion-canvas, .remotion-studio-composition-container, input, textarea, select, [contenteditable], code, pre, [data-fuckvideo-overlay]";

const textOriginals = new Map<Text, { original: string; written: string }>();
const attrOriginals = new Map<Element, Partial<Record<(typeof ATTRS)[number], { original: string; written: string }>>>();
let observer: MutationObserver | null = null;
let pending: Node[] = [];
let scheduled = false;

function zh(value: string): string | null {
  const key = value.trim();
  const hit = key ? STUDIO_ZH[key] : undefined;
  return hit && hit !== key ? value.replace(key, hit) : null;
}

function skipped(el: Element | null) {
  return !el || !!el.closest(SKIP);
}

function translateText(node: Text) {
  const known = textOriginals.get(node);
  if (known && node.nodeValue === known.written) return;
  if (skipped(node.parentElement)) return;
  const next = zh(node.nodeValue || "");
  if (!next) {
    textOriginals.delete(node);
    return;
  }
  textOriginals.set(node, { original: node.nodeValue || "", written: next });
  node.nodeValue = next;
}

function translateAttrs(el: Element) {
  if (el.closest("[data-fuckvideo-overlay], #remotion-canvas, .remotion-studio-composition-container")) return;
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const record = attrOriginals.get(el) || {};
    if (record[attr]?.written === value) continue;
    const next = zh(value);
    if (!next) continue;
    record[attr] = { original: value, written: next };
    attrOriginals.set(el, record);
    el.setAttribute(attr, next);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (el.matches("[data-fuckvideo-overlay], #remotion-canvas, .remotion-studio-composition-container")) return;
  translateAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateAttrs(n as Element);
  }
}

function flush() {
  scheduled = false;
  const batch = pending;
  pending = [];
  for (const node of batch) if (node.isConnected) walk(node);
  for (const node of textOriginals.keys()) if (!node.isConnected) textOriginals.delete(node);
  for (const el of attrOriginals.keys()) if (!el.isConnected) attrOriginals.delete(el);
}

function queue(node: Node) {
  pending.push(node);
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(flush);
  }
}

export function startStudioTranslation() {
  if (observer) return;
  walk(document.body);
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") m.addedNodes.forEach(queue);
      else queue(m.target);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
}

export function stopStudioTranslation() {
  observer?.disconnect();
  observer = null;
  pending = [];
  for (const [node, { original, written }] of textOriginals) {
    if (node.isConnected && node.nodeValue === written) node.nodeValue = original;
  }
  for (const [el, record] of attrOriginals) {
    for (const attr of ATTRS) {
      const r = record[attr];
      if (r && el.getAttribute(attr) === r.written) el.setAttribute(attr, r.original);
    }
  }
  textOriginals.clear();
  attrOriginals.clear();
}
