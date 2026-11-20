import type { RotationDegree, ScanFilterMode } from './types';

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export function nextRotation(current: RotationDegree): RotationDegree {
  switch (current) {
    case 0:
      return 90;
    case 90:
      return 180;
    case 180:
      return 270;
    case 270:
      return 0;
  }
}

export function computeRotatedDimensions(
  width: number,
  height: number,
  rotationDeg: RotationDegree,
): Dimensions {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  if (rotationDeg === 90 || rotationDeg === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

export function computeScaledDimensions(
  width: number,
  height: number,
  maxLongEdge: number,
): Dimensions {
  if (width <= 0 || height <= 0 || maxLongEdge <= 0) {
    return { width: 0, height: 0 };
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 將影像像素進行高對比掃瞄增強：抑制紙張灰暗陰影、強化文字與線條對比度。
 */
export function applyHighContrastScanFilter(
  rgba: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const a = rgba[i + 3] ?? 255;

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    let enhanced: number;
    if (luma >= 185) {
      enhanced = 255;
    } else if (luma <= 75) {
      enhanced = Math.round(luma * 0.45);
    } else {
      const normalized = (luma - 75) / (185 - 75);
      enhanced = Math.round(34 + normalized * (255 - 34));
    }

    out[i] = enhanced;
    out[i + 1] = enhanced;
    out[i + 2] = enhanced;
    out[i + 3] = a;
  }
  return out;
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('無法載入選擇的圖片檔案'));
    img.src = src;
  });
}

export async function renderProcessedWorksheetImage(
  sourceUrl: string,
  rotationDeg: RotationDegree,
  filter: ScanFilterMode,
  maxLongEdge = 1600,
): Promise<{ readonly dataUrl: string; readonly width: number; readonly height: number }> {
  const img = await loadImageElement(sourceUrl);
  const rotated = computeRotatedDimensions(img.naturalWidth, img.naturalHeight, rotationDeg);
  const target = computeScaledDimensions(rotated.width, rotated.height, maxLongEdge);

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('無法建立影像處理畫布');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, target.width, target.height);

  ctx.save();
  ctx.translate(target.width / 2, target.height / 2);
  ctx.rotate((rotationDeg * Math.PI) / 180);

  const drawSize =
    rotationDeg === 90 || rotationDeg === 270
      ? { width: target.height, height: target.width }
      : { width: target.width, height: target.height };

  ctx.drawImage(img, -drawSize.width / 2, -drawSize.height / 2, drawSize.width, drawSize.height);
  ctx.restore();

  if (filter === 'high-contrast') {
    const imageData = ctx.getImageData(0, 0, target.width, target.height);
    const filtered = applyHighContrastScanFilter(imageData.data);
    const nextImageData = new ImageData(
      new Uint8ClampedArray(filtered),
      target.width,
      target.height,
    );
    ctx.putImageData(nextImageData, 0, 0);
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.86),
    width: target.width,
    height: target.height,
  };
}
