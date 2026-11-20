export interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
}

export type PenColor = '#111827' | '#2563eb' | '#dc2626' | '#16a34a';

export type StrokeWidthPreset = 'thin' | 'medium' | 'thick';

export type ActiveTool =
  | { readonly kind: 'pen'; readonly color: PenColor; readonly widthRatio: number }
  | { readonly kind: 'erase'; readonly widthRatio: number };

export type InkCommand =
  | {
      readonly kind: 'pen';
      readonly id: string;
      readonly color: PenColor;
      readonly widthRatio: number;
      readonly points: readonly NormalizedPoint[];
    }
  | {
      readonly kind: 'erase';
      readonly id: string;
      readonly widthRatio: number;
      readonly points: readonly NormalizedPoint[];
    };

export type ScanFilterMode = 'original' | 'high-contrast';

export type RotationDegree = 0 | 90 | 180 | 270;

export interface WorksheetRecord {
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly width: number;
  readonly height: number;
  readonly baseImageDataUrl: string;
  readonly inkCommands: readonly InkCommand[];
}

export interface BackupBundle {
  readonly version: 1;
  readonly exportedAt: number;
  readonly worksheets: readonly WorksheetRecord[];
}

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function assertNever(value: never): never {
  throw new Error(`Unexpected exhaustive value: ${String(value)}`);
}
