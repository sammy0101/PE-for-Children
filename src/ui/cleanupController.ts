import { normalizePoint, type ViewportRect } from '../domain/inkEngine';
import {
  assertNever,
  type WhiteoutCommand,
  type WhiteoutToolKind,
} from '../domain/types';
import {
  clearWhiteoutCommands,
  isMeaningfulWhiteoutCommand,
  undoWhiteoutCommand,
} from '../domain/whiteoutEngine';
import type { PointerInput } from './canvasController';

export interface CleanupControllerState {
  readonly commands: readonly WhiteoutCommand[];
  readonly activeCommand: WhiteoutCommand | null;
  readonly activePointerId: number | null;
  readonly toolKind: WhiteoutToolKind;
  readonly previousDrawTool: 'brush' | 'rect';
  readonly fillColor: string;
  readonly brushWidthRatio: number;
}

export function createInitialCleanupState(): CleanupControllerState {
  return {
    commands: [],
    activeCommand: null,
    activePointerId: null,
    toolKind: 'brush',
    previousDrawTool: 'brush',
    fillColor: '#ffffff',
    brushWidthRatio: 0.028,
  };
}

export function setCleanupTool(
  state: CleanupControllerState,
  toolKind: WhiteoutToolKind,
): CleanupControllerState {
  const previousDrawTool =
    toolKind === 'brush' || toolKind === 'rect' ? toolKind : state.previousDrawTool;
  return {
    ...state,
    toolKind,
    previousDrawTool,
    activeCommand: null,
    activePointerId: null,
  };
}

export function applyPickedPaperColor(
  state: CleanupControllerState,
  hexColor: string,
): CleanupControllerState {
  return {
    ...state,
    fillColor: hexColor,
    toolKind: state.previousDrawTool,
  };
}

export function handleCleanupPointerDown(
  state: CleanupControllerState,
  input: PointerInput,
  rect: ViewportRect,
  commandId: string,
): CleanupControllerState {
  if (state.activePointerId !== null || state.toolKind === 'eyedropper') {
    return state;
  }

  const point = normalizePoint(input.clientX, input.clientY, rect, input.pressure);

  switch (state.toolKind) {
    case 'brush':
      return {
        ...state,
        activePointerId: input.pointerId,
        activeCommand: {
          kind: 'brush',
          id: commandId,
          color: state.fillColor,
          widthRatio: state.brushWidthRatio,
          points: [point],
        },
      };
    case 'rect':
      return {
        ...state,
        activePointerId: input.pointerId,
        activeCommand: {
          kind: 'rect',
          id: commandId,
          color: state.fillColor,
          start: point,
          end: point,
        },
      };
    default:
      return state;
  }
}

export function handleCleanupPointerMove(
  state: CleanupControllerState,
  input: PointerInput,
  rect: ViewportRect,
): CleanupControllerState {
  if (state.activePointerId !== input.pointerId || !state.activeCommand) {
    return state;
  }

  const point = normalizePoint(input.clientX, input.clientY, rect, input.pressure);
  const active = state.activeCommand;

  switch (active.kind) {
    case 'brush': {
      const last = active.points[active.points.length - 1];
      if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.001) {
        return state;
      }
      return {
        ...state,
        activeCommand: {
          ...active,
          points: [...active.points, point],
        },
      };
    }
    case 'rect':
      return {
        ...state,
        activeCommand: {
          ...active,
          end: point,
        },
      };
    default:
      return assertNever(active);
  }
}

export function handleCleanupPointerUpOrCancel(
  state: CleanupControllerState,
  pointerId: number,
): CleanupControllerState {
  if (state.activePointerId !== pointerId || !state.activeCommand) {
    return state;
  }

  const nextCommands = isMeaningfulWhiteoutCommand(state.activeCommand)
    ? [...state.commands, state.activeCommand]
    : state.commands;

  return {
    ...state,
    commands: nextCommands,
    activeCommand: null,
    activePointerId: null,
  };
}

export function undoCleanup(state: CleanupControllerState): CleanupControllerState {
  return {
    ...state,
    commands: undoWhiteoutCommand(state.commands),
    activeCommand: null,
    activePointerId: null,
  };
}

export function resetCleanup(state: CleanupControllerState): CleanupControllerState {
  return {
    ...state,
    commands: clearWhiteoutCommands(),
    activeCommand: null,
    activePointerId: null,
  };
}
