import { describe, expect, it } from 'vitest';
import {
  clearControllerInk,
  createInitialCanvasState,
  handlePointerDown,
  handlePointerMove,
  handlePointerUpOrCancel,
} from '../src/ui/canvasController';

describe('canvasController (Palm Rejection & Stroke Lifecycle)', () => {
  const rect = { left: 0, top: 0, width: 1000, height: 1000 };

  it('rejects touch input when pencilOnlyMode is enabled, while accepting pen', () => {
    const initial = createInitialCanvasState([], true);

    const afterTouch = handlePointerDown(
      initial,
      { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100, pressure: 0.5 },
      rect,
      'cmd_touch',
    );
    expect(afterTouch.activeCommand).toBeNull();

    const afterPen = handlePointerDown(
      initial,
      { pointerId: 2, pointerType: 'pen', clientX: 200, clientY: 200, pressure: 0.7 },
      rect,
      'cmd_pen',
    );
    expect(afterPen.activeCommand?.id).toBe('cmd_pen');
  });

  it('commits stroke on pointerup and supports full clear', () => {
    let state = createInitialCanvasState([], false);
    state = handlePointerDown(
      state,
      { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100, pressure: 0.5 },
      rect,
      'cmd_1',
    );
    state = handlePointerMove(
      state,
      { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 300, pressure: 0.5 },
      rect,
    );
    const { nextState, committed } = handlePointerUpOrCancel(state, 1);

    expect(committed).toBe(true);
    expect(nextState.commands).toHaveLength(1);

    const cleared = clearControllerInk(nextState);
    expect(cleared.commands).toEqual([]);
  });
});
