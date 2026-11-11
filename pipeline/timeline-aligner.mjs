export function alignScenesToCaptions(scenes, captions, options = {}) {
  const fps = Number(options.fps || 30);
  const totalFrames = Number(options.totalFrames || 0);
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return [];
  }
  if (!Array.isArray(captions) || captions.length === 0) {
    return stretchScenesToFrames(scenes, totalFrames || sumFrames(scenes));
  }

  const groups = groupCaptionsByScene(scenes, captions);
  let cursor = 0;
  const aligned = scenes.map((scene, index) => {
    const group = groups[index] || [];
    const startMs = group[0]?.startMs ?? Math.round((cursor / fps) * 1000);
    const endMs =
      group[group.length - 1]?.endMs ??
      Math.round(((cursor + Math.max(1, scene.durationInFrames)) / fps) * 1000);
    const fromFrame = Math.max(cursor, Math.floor((startMs / 1000) * fps));
    const desiredDuration = Math.max(30, Math.ceil(((Math.max(endMs, startMs + 500) - startMs) / 1000) * fps));
    const durationInFrames = Math.max(30, desiredDuration);
    const next = {
      ...scene,
      fromFrame,
      durationInFrames,
      durationSec: Math.round((durationInFrames / fps) * 100) / 100,
      audioStartMs: startMs,
      audioEndMs: Math.max(endMs, startMs + 500),
      timingSource: "captions",
    };
    cursor = fromFrame + durationInFrames;
    return next;
  });

  return stretchScenesToFrames(aligned, Math.max(totalFrames, cursor));
}

export function stretchScenesToFrames(scenes, targetFrames) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return [];
  }
  const sourceFrames = sumFrames(scenes);
  if (!targetFrames || sourceFrames >= targetFrames) {
    return normalizeSceneFrames(scenes);
  }
  const ratio = targetFrames / sourceFrames;
  let cursor = 0;
  return scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1;
    const durationInFrames = isLast ? targetFrames - cursor : Math.max(30, Math.round(scene.durationInFrames * ratio));
    const next = {
      ...scene,
      fromFrame: cursor,
      durationInFrames,
      durationSec: Math.round((durationInFrames / Number(scene.fps || 30)) * 100) / 100,
      timingSource: scene.timingSource || "estimated",
    };
    cursor += durationInFrames;
    return next;
  });
}

function normalizeSceneFrames(scenes) {
  let cursor = 0;
  return scenes.map((scene) => {
    const fromFrame = Math.max(cursor, Number(scene.fromFrame || 0));
    const durationInFrames = Math.max(1, Number(scene.durationInFrames || 1));
    cursor = fromFrame + durationInFrames;
    return { ...scene, fromFrame, durationInFrames };
  });
}

function groupCaptionsByScene(scenes, captions) {
  const cleanSceneLengths = scenes.map((scene) => Math.max(1, cleanText(scene.narrationText || scene.text).length));
  const totalSceneLength = cleanSceneLengths.reduce((sum, length) => sum + length, 0);
  const cleanCaptionLengths = captions.map((caption) => Math.max(1, cleanText(caption.text).length));
  const totalCaptionLength = cleanCaptionLengths.reduce((sum, length) => sum + length, 0);

  if (totalCaptionLength < Math.max(6, totalSceneLength * 0.25)) {
    return proportionalCaptionGroups(scenes, captions);
  }

  const groups = scenes.map(() => []);
  let captionIndex = 0;
  let consumedCaptionChars = 0;
  let targetSceneChars = 0;

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    targetSceneChars += cleanSceneLengths[sceneIndex];
    const targetRatio = targetSceneChars / totalSceneLength;
    const targetCaptionChars = targetRatio * totalCaptionLength;
    while (captionIndex < captions.length && (consumedCaptionChars < targetCaptionChars || groups[sceneIndex].length === 0)) {
      groups[sceneIndex].push(captions[captionIndex]);
      consumedCaptionChars += cleanCaptionLengths[captionIndex];
      captionIndex += 1;
    }
  }

  while (captionIndex < captions.length) {
    groups[groups.length - 1].push(captions[captionIndex]);
    captionIndex += 1;
  }
  return groups;
}

function proportionalCaptionGroups(scenes, captions) {
  const groups = scenes.map(() => []);
  for (let index = 0; index < captions.length; index += 1) {
    const sceneIndex = Math.min(scenes.length - 1, Math.floor((index / captions.length) * scenes.length));
    groups[sceneIndex].push(captions[index]);
  }
  return groups;
}

function cleanText(value) {
  return String(value || "").replace(/[\s，。！？、；：,.!?;:"“”《》]/g, "");
}

function sumFrames(scenes) {
  return scenes.reduce((sum, scene) => sum + Math.max(1, Number(scene.durationInFrames || 1)), 0);
}
