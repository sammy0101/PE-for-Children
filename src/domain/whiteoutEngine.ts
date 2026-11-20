import type { ViewportSize } from './inkEngine';
import { loadImageElement } from './scanProcessor';
import {
  assertNever,
  type NormalizedPoint,
  type WhiteoutCommand,
} from './types';

export interface NormalizedRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WhiteoutCanvasContext2D {
  globalCompositeOperation: GlobalCompositeOperation;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void;
  stroke(): void;
  fill(): void;
}

export function normalizeRect(
  start: NormalizedPoint,
  end: NormalizedPoint,
): NormalizedRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number): string => {
    const clamped = Math.min(255, Math.max(0, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function isMeaningfulWhiteoutCommand(cmd: WhiteoutCommand): boolean {
  switch (cmd.kind) {
    case 'brush':
      return cmd.points.length > 0;
    case 'rect': {
      const r = normalizeRect(cmd.start, cmd.end);
      return r.width >= 0.005 || r.height >= 0.005;
    }
    default:
      return assertNever(cmd);
  }
}

export function undoWhiteoutCommand(
  commands: readonly WhiteoutCommand[],
): readonly WhiteoutCommand[] {
  if (commands.length === 0) return commands;
  return commands.slice(0, -1);
}

export function clearWhiteoutCommands(): readonly WhiteoutCommand[] {
  return [];
}

function drawWhiteoutBrush(
  ctx: WhiteoutCanvasContext2D,
  cmd: Extract<WhiteoutCommand, { readonly kind: 'brush' }>,
  viewport: ViewportSize,
): void {
  const firstPoint = cmd.points[0];
  if (!firstPoint) return;

  const strokeWidth = Math.max(4, cmd.widthRatio * viewport.width);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = cmd.color;
  ctx.fillStyle = cmd.color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const toPixel = (pt: NormalizedPoint): { x: number; y: number } => ({
    x: pt.x * viewport.width,
    y: pt.y * viewport.height,
  });

  if (cmd.points.length === 1) {
    const p = toPixel(firstPoint);
    ctx.beginPath();
    ctx.arc(p.x, p.y, strokeWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  const start = toPixel(firstPoint);
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < cmd.points.length - 1; i++) {
    const currRaw = cmd.points[i];
    const nextRaw = cmd.points[i + 1];
    if (!currRaw || !nextRaw) continue;
    const curr = toPixel(currRaw);
    const next = toPixel(nextRaw);
    ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
  }

  const lastRaw = cmd.points[cmd.points.length - 1];
  if (lastRaw) {
    const last = toPixel(lastRaw);
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}

export function paintWhiteoutCommands(
  ctx: WhiteoutCanvasContext2D,
  commands: readonly WhiteoutCommand[],
  viewport: ViewportSize,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;

  for (const cmd of commands) {
    switch (cmd.kind) {
      case 'brush':
        drawWhiteoutBrush(ctx, cmd, viewport);
        break;
      case 'rect': {
        const rect = normalizeRect(cmd.start, cmd.end);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = cmd.color;
        ctx.fillRect(
          rect.x * viewport.width,
          rect.y * viewport.height,
          rect.width * viewport.width,
          rect.height * viewport.height,
        );
        break;
      }
      default:
        assertNever(cmd);
    }
  }
}

export function renderWhiteoutOverlay(
  ctx: WhiteoutCanvasContext2D,
  commands: readonly WhiteoutCommand[],
  viewport: ViewportSize,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  paintWhiteoutCommands(ctx, commands, viewport);
}

export async function bakeWhiteoutOntoImage(
  baseImageDataUrl: string,
  width: number,
  height: number,
  commands: readonly WhiteoutCommand[],
): Promise<string> {
  if (commands.length === 0) {
    return baseImageDataUrl;
  }

  const img = await loadImageElement(baseImageDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('無法建立底圖合成畫布');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  paintWhiteoutCommands(ctx, commands, { width, height });

  return canvas.toDataURL('image/jpeg', 0.88);
}
