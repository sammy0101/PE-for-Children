import {
  assertNever,
  type ActiveTool,
  type InkCommand,
  type NormalizedPoint,
} from './types';

export interface ViewportRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface InkCanvasContext2D {
  globalCompositeOperation: string;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  stroke(): void;
  fill(): void;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function normalizePoint(
  clientX: number,
  clientY: number,
  rect: ViewportRect,
  pressure?: number,
): NormalizedPoint {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0, pressure: 0.5 };
  }
  const safePressure =
    typeof pressure === 'number' && Number.isFinite(pressure) && pressure > 0
      ? clamp01(pressure)
      : 0.5;
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
    pressure: safePressure,
  };
}

export function createInkCommand(
  id: string,
  tool: ActiveTool,
  initialPoint: NormalizedPoint,
): InkCommand {
  switch (tool.kind) {
    case 'pen':
      return {
        kind: 'pen',
        id,
        color: tool.color,
        widthRatio: tool.widthRatio,
        points: [initialPoint],
      };
    case 'erase':
      return {
        kind: 'erase',
        id,
        widthRatio: tool.widthRatio,
        points: [initialPoint],
      };
    default:
      return assertNever(tool);
  }
}

export function appendPointToCommand(
  command: InkCommand,
  point: NormalizedPoint,
): InkCommand {
  const last = command.points[command.points.length - 1];
  if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.0008) {
    return command;
  }
  return {
    ...command,
    points: [...command.points, point],
  };
}

export function appendInkCommand(
  commands: readonly InkCommand[],
  next: InkCommand,
): readonly InkCommand[] {
  if (next.points.length === 0) {
    return commands;
  }
  return [...commands, next];
}

export function undoInkCommand(
  commands: readonly InkCommand[],
): readonly InkCommand[] {
  if (commands.length === 0) {
    return commands;
  }
  return commands.slice(0, -1);
}

export function clearAllInk(): readonly InkCommand[] {
  return [];
}

function drawSingleCommand(
  ctx: InkCanvasContext2D,
  command: InkCommand,
  viewport: ViewportSize,
): void {
  const firstPoint = command.points[0];
  if (!firstPoint) return;

  const strokeWidth = Math.max(1.5, command.widthRatio * viewport.width);

  switch (command.kind) {
    case 'pen':
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = command.color;
      ctx.fillStyle = command.color;
      break;
    case 'erase':
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      break;
    default:
      assertNever(command);
  }

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const toPixel = (pt: NormalizedPoint): { x: number; y: number } => ({
    x: pt.x * viewport.width,
    y: pt.y * viewport.height,
  });

  if (command.points.length === 1) {
    const p = toPixel(firstPoint);
    ctx.beginPath();
    ctx.arc(p.x, p.y, strokeWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  const start = toPixel(firstPoint);
  ctx.moveTo(start.x, start.y);

  for (let i = 1; i < command.points.length - 1; i++) {
    const currRaw = command.points[i];
    const nextRaw = command.points[i + 1];
    if (!currRaw || !nextRaw) continue;
    const curr = toPixel(currRaw);
    const next = toPixel(nextRaw);
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
  }

  const lastRaw = command.points[command.points.length - 1];
  if (lastRaw) {
    const last = toPixel(lastRaw);
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}

export function renderInkCommands(
  ctx: InkCanvasContext2D,
  commands: readonly InkCommand[],
  viewport: ViewportSize,
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return;

  ctx.clearRect(0, 0, viewport.width, viewport.height);
  for (const cmd of commands) {
    drawSingleCommand(ctx, cmd, viewport);
  }
  ctx.globalCompositeOperation = 'source-over';
}
