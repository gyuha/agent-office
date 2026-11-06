/** Fit a rendered scene to its container without enlarging it. */
export function fitSceneWidth(width: number, height: number, availableWidth: number) {
  const scale = Math.min(1, Math.max(0, availableWidth) / width);
  return { width: width * scale, height: height * scale };
}
