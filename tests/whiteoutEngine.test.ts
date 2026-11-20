import { describe, expect, it } from 'vitest';
import {
  isMeaningfulWhiteoutCommand,
  normalizeRect,
  paintWhiteoutCommands,
  renderWhiteoutOverlay,
  rgbToHex,
  undoWhiteoutCommand,
  type WhiteoutCanvasContext2D,
} from '../src/domain/whiteoutEngine';

function createMockWhiteoutCtx(): {
  ctx: WhiteoutCanvasContext2D;
  calls: string[];
} {
  const calls: string[] = [];
  const ctx: WhiteoutCanvasContext2D = {
    globalCompositeOperation: 'source-over',
    strokeStyle: '#ffffff',
    fillStyle: '#ffffff',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    clearRect: () => calls.push('clearRect'),
    fillRect: (x, y, w, h) => calls.push(`fillRect:${x},${y},${w},${h}`),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    quadraticCurveTo: () => calls.push('quadraticCurveTo'),
    arc: () => calls.push('arc'),
    stroke: () => calls.push(`stroke:${String(ctx.strokeStyle)}`),
    fill: () => calls.push(`fill:${String(ctx.fillStyle)}`),
  };
  return { ctx, calls };
}

describe('whiteoutEngine', () => {
  it('normalizes reverse-drag rectangles accurately', () => {
    const rect = normalizeRect(
      { x: 0.8, y: 0.7, pressure: 0.5 },
      { x: 0.2, y: 0.1, pressure: 0.5 },
    );
    expect(rect.x).toBeCloseTo(0.2);
    expect(rect.y).toBeCloseTo(0.1);
    expect(rect.width).toBeCloseTo(0.6);
    expect(rect.height).toBeCloseTo(0.6);
  });

  it('converts RGB channels to lowercase hex strings cleanly', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(245, 240, 220)).toBe('#f5f0dc');
    expect(rgbToHex(-10, 300, 15)).toBe('#00ff0f');
  });

  it('filters out tiny accidental rect taps and supports undo', () => {
    const tinyRect = {
      kind: 'rect' as const,
      id: 'r1',
      color: '#ffffff',
      start: { x: 0.5, y: 0.5, pressure: 0.5 },
      end: { x: 0.501, y: 0.501, pressure: 0.5 },
    };
    const validRect = {
      kind: 'rect' as const,
      id: 'r2',
      color: '#f8fafc',
      start: { x: 0.1, y: 0.1, pressure: 0.5 },
      end: { x: 0.4, y: 0.3, pressure: 0.5 },
    };

    expect(isMeaningfulWhiteoutCommand(tinyRect)).toBe(false);
    expect(isMeaningfulWhiteoutCommand(validRect)).toBe(true);
    expect(undoWhiteoutCommand([validRect])).toEqual([]);
  });

  it('paints without clearRect when baking, and clears when rendering overlay', () => {
    const cmd = {
      kind: 'rect' as const,
      id: 'r1',
      color: '#ffffff',
      start: { x: 0.1, y: 0.2, pressure: 0.5 },
      end: { x: 0.3, y: 0.4, pressure: 0.5 },
    };

    const bake = createMockWhiteoutCtx();
    paintWhiteoutCommands(bake.ctx, [cmd], { width: 1000, height: 1000 });
    expect(bake.calls).not.toContain('clearRect');
    expect(bake.calls).toContain('fillRect:100,200,200,200');

    const overlay = createMockWhiteoutCtx();
    renderWhiteoutOverlay(overlay.ctx, [cmd], { width: 1000, height: 1000 });
    expect(overlay.calls[0]).toBe('clearRect');
  });
});
