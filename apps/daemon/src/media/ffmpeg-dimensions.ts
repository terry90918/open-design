/** Parse FFmpeg's encoded dimensions into the displayed frame dimensions. */
export function parseVideoDimensions(stderr: string): { width: number; height: number } {
  const video = /Stream #\S+.*?Video:([^\n]*)/.exec(stderr);
  const size = /\b(\d{2,5})x(\d{2,5})\b/.exec(video?.[1] ?? '');
  if (!size) return { width: 0, height: 0 };

  const encodedWidth = Number(size[1]);
  const encodedHeight = Number(size[2]);
  const foundRotation = /displaymatrix:\s*rotation of\s*([+-]?\d+(?:\.\d+)?)\s*degrees/i.exec(stderr);
  const parsedRotation = Number(foundRotation?.[1] ?? 0);
  const rotation = Number.isFinite(parsedRotation) ? parsedRotation : 0;
  const radians = (rotation * Math.PI) / 180;
  return {
    width: Math.ceil(Math.abs(encodedWidth * Math.cos(radians)) + Math.abs(encodedHeight * Math.sin(radians)) - 1e-9),
    height: Math.ceil(Math.abs(encodedWidth * Math.sin(radians)) + Math.abs(encodedHeight * Math.cos(radians)) - 1e-9),
  };
}
