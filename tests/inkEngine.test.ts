import { describe, expect, it } from 'vitest';
import {
  appendInkCommand,
  appendPointToCommand,
  clearAllInk,
  createInkCommand,
  normalizePoint,
  renderInkCommands,
  undoInkCommand,
  type InkCanvasContext2D,
} from '../src/domain/inkEngine';

function createMockCanvasContext(): {
  ctx: InkCanvasContext2D;
  ops: string[];
} {
  const ops: string[] = [];
  const ctx: InkCanvasContext2D = {
    globalCompositeOperation: 'source-over',
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    clearRect: () => ops.push('clearRect'),
    beginPath: () => ops.push('beginPath'),
    moveTo: () => ops.push('moveTo'),
    lineTo: () => ops.push('lineTo'),
    quadraticCurveTo: () => ops.push('quadraticCurveTo'),
    arc: () => ops.push('arc'),
    stroke: () => ops.push(`stroke:${ctx.globalCompositeOperation}`),
    fill: () => ops.push(`fill:${ctx.globalCompositeOperation}`),
  };
  return { ctx, ops };
}

describe('inkEngine', () => {
  it('normalizes pointer coordinates into [0, 1] regardless of viewport size', () => {
    const pt = normalizePoint(250, 150, { left: 50, top: 50, width: 400, height: 200 }, 0.8);
    expect(pt).toEqual({ x: 0.5, y: 0.5, pressure: 0.8 });

    const clamped = normalizePoint(-20, 999, { left: 0, top: 0, width: 100, height: 100 });
    expect(clamped).toEqual({ x: 0, y: 1, pressure: 0.5 });
  });

  it('supports undo and one-click clear without mutating prior arrays', () => {
    const c1 = createInkCommand('1', { kind: 'pen', color: '#2563eb', widthRatio: 0.005 }, { x: 0.1, y: 0.1, pressure: 0.5 });
    const c2 = appendPointToCommand(
      createInkCommand('2', { kind: 'erase', widthRatio: 0.03 }, { x: 0.2, y: 0.2, pressure: 0.5 }),
      { x: 0.5, y: 0.5, pressure: 0.5 },
    );

    const list = appendInkCommand(appendInkCommand([], c1), c2);
    expect(list).toHaveLength(2);

    const undone = undoInkCommand(list);
    expect(undone).toHaveLength(1);
    expect(undone[0]?.id).toBe('1');
    expect(list).toHaveLength(2);

    const cleared = clearAllInk();
    expect(cleared).toEqual([]);
  });

  it('renders pen with source-over, eraser with destination-out, and resets composite op', () => {
    const pen = createInkCommand('p1', { kind: 'pen', color: '#111827', widthRatio: 0.005 }, { x: 0.1, y: 0.1, pressure: 0.5 });
    const erase = appendPointToCommand(
      createInkCommand('e1', { kind: 'erase', widthRatio: 0.03 }, { x: 0.2, y: 0.2, pressure: 0.5 }),
      { x: 0.4, y: 0.4, pressure: 0.5 },
    );

    const { ctx, ops } = createMockCanvasContext();
    renderInkCommands(ctx, [pen, erase], { width: 1000, height: 800 });

    expect(ops).toContain('fill:source-over');
    expect(ops).toContain('stroke:destination-out');
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });
});
