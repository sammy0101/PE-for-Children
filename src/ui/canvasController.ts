import {
  appendInkCommand,
  appendPointToCommand,
  clearAllInk,
  createInkCommand,
  normalizePoint,
  undoInkCommand,
  type ViewportRect,
} from '../domain/inkEngine';
import type { ActiveTool, InkCommand } from '../domain/types';

export interface PointerInput {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly pressure: number;
}

export interface CanvasControllerState {
  readonly commands: readonly InkCommand[];
  readonly activeCommand: InkCommand | null;
  readonly activePointerId: number | null;
  readonly pencilOnlyMode: boolean;
  readonly tool: ActiveTool;
}

export function shouldAcceptPointerStroke(
  pointerType: string,
  pencilOnlyMode: boolean,
): boolean {
  if (pencilOnlyMode) {
    return pointerType === 'pen';
  }
  return pointerType === 'pen' || pointerType === 'touch' || pointerType === 'mouse';
}

export function createInitialCanvasState(
  commands: readonly InkCommand[] = [],
  pencilOnlyMode = false,
): CanvasControllerState {
  return {
    commands,
    activeCommand: null,
    activePointerId: null,
    pencilOnlyMode,
    tool: { kind: 'pen', color: '#2563eb', widthRatio: 0.0045 },
  };
}

export function handlePointerDown(
  state: CanvasControllerState,
  input: PointerInput,
  rect: ViewportRect,
  commandId: string,
): CanvasControllerState {
  if (state.activePointerId !== null) {
    return state;
  }
  if (!shouldAcceptPointerStroke(input.pointerType, state.pencilOnlyMode)) {
    return state;
  }

  const point = normalizePoint(input.clientX, input.clientY, rect, input.pressure);
  const activeCommand = createInkCommand(commandId, state.tool, point);

  return {
    ...state,
    activePointerId: input.pointerId,
    activeCommand,
  };
}

export function handlePointerMove(
  state: CanvasControllerState,
  input: PointerInput,
  rect: ViewportRect,
): CanvasControllerState {
  if (state.activePointerId !== input.pointerId || !state.activeCommand) {
    return state;
  }
  const point = normalizePoint(input.clientX, input.clientY, rect, input.pressure);
  return {
    ...state,
    activeCommand: appendPointToCommand(state.activeCommand, point),
  };
}

export function handlePointerUpOrCancel(
  state: CanvasControllerState,
  pointerId: number,
): { readonly nextState: CanvasControllerState; readonly committed: boolean } {
  if (state.activePointerId !== pointerId || !state.activeCommand) {
    return { nextState: state, committed: false };
  }

  const nextCommands = appendInkCommand(state.commands, state.activeCommand);
  return {
    nextState: {
      ...state,
      commands: nextCommands,
      activeCommand: null,
      activePointerId: null,
    },
    committed: true,
  };
}

export function undoControllerInk(state: CanvasControllerState): CanvasControllerState {
  return {
    ...state,
    commands: undoInkCommand(state.commands),
    activeCommand: null,
    activePointerId: null,
  };
}

export function clearControllerInk(state: CanvasControllerState): CanvasControllerState {
  return {
    ...state,
    commands: clearAllInk(),
    activeCommand: null,
    activePointerId: null,
  };
}
