import { describe, expect, it } from 'vitest';
import {
  applyPickedPaperColor,
  createInitialCleanupState,
  handleCleanupPointerDown,
  handleCleanupPointerMove,
  handleCleanupPointerUpOrCancel,
  setCleanupTool,
  undoCleanup,
} from '../src/ui/cleanupController';

describe('cleanupController', () => {
  const rect = { left: 0, top: 0, width: 1000, height: 1000 };

  it('creates whiteout rectangle commands on drag and supports undo', () => {
    let state = setCleanupTool(createInitialCleanupState(), 'rect');

    state = handleCleanupPointerDown(
      state,
      { pointerId: 1, pointerType: 'pen', clientX: 100, clientY: 100, pressure: 0.5 },
      rect,
      'wo_1',
    );
    state = handleCleanupPointerMove(
      state,
      { pointerId: 1, pointerType: 'pen', clientX: 400, clientY: 250, pressure: 0.5 },
      rect,
    );
    state = handleCleanupPointerUpOrCancel(state, 1);

    expect(state.commands).toHaveLength(1);
    expect(state.commands[0]?.kind).toBe('rect');

    state = undoCleanup(state);
    expect(state.commands).toEqual([]);
  });

  it('switches to eyedropper without drawing and returns to previous draw tool after picking', () => {
    let state = setCleanupTool(createInitialCleanupState(), 'rect');
    state = setCleanupTool(state, 'eyedropper');

    const afterTap = handleCleanupPointerDown(
      state,
      { pointerId: 2, pointerType: 'touch', clientX: 50, clientY: 50, pressure: 0.5 },
      rect,
      'ignored',
    );
    expect(afterTap.activeCommand).toBeNull();

    const afterPicked = applyPickedPaperColor(afterTap, '#f4f1ea');
    expect(afterPicked.fillColor).toBe('#f4f1ea');
    expect(afterPicked.toolKind).toBe('rect');
  });
});
