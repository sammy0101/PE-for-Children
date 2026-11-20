import type {
  BackupBundle,
  InkCommand,
  NormalizedPoint,
  PenColor,
  Result,
  WorksheetRecord,
} from '../domain/types';

export type BackupCodecError =
  | { readonly code: 'INVALID_JSON'; readonly message: string }
  | { readonly code: 'INVALID_SCHEMA'; readonly message: string };

const VALID_COLORS = new Set<PenColor>(['#111827', '#2563eb', '#dc2626', '#16a34a']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePoint(raw: unknown): NormalizedPoint | null {
  if (!isRecord(raw)) return null;
  if (!isFiniteNumber(raw['x']) || !isFiniteNumber(raw['y']) || !isFiniteNumber(raw['pressure'])) {
    return null;
  }
  return {
    x: Math.min(1, Math.max(0, raw['x'])),
    y: Math.min(1, Math.max(0, raw['y'])),
    pressure: Math.min(1, Math.max(0, raw['pressure'])),
  };
}

function parseInkCommand(raw: unknown): InkCommand | null {
  if (!isRecord(raw)) return null;
  if (typeof raw['id'] !== 'string' || !isFiniteNumber(raw['widthRatio']) || raw['widthRatio'] <= 0) {
    return null;
  }
  if (!Array.isArray(raw['points'])) return null;

  const points: NormalizedPoint[] = [];
  for (const pt of raw['points']) {
    const parsed = parsePoint(pt);
    if (!parsed) return null;
    points.push(parsed);
  }

  if (raw['kind'] === 'pen') {
    const color = raw['color'];
    if (typeof color !== 'string' || !VALID_COLORS.has(color as PenColor)) {
      return null;
    }
    return {
      kind: 'pen',
      id: raw['id'],
      color: color as PenColor,
      widthRatio: raw['widthRatio'],
      points,
    };
  }

  if (raw['kind'] === 'erase') {
    return {
      kind: 'erase',
      id: raw['id'],
      widthRatio: raw['widthRatio'],
      points,
    };
  }

  return null;
}

function parseWorksheetRecord(raw: unknown): WorksheetRecord | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw['id'] !== 'string' ||
    typeof raw['title'] !== 'string' ||
    !isFiniteNumber(raw['createdAt']) ||
    !isFiniteNumber(raw['updatedAt']) ||
    !isFiniteNumber(raw['width']) ||
    !isFiniteNumber(raw['height']) ||
    raw['width'] <= 0 ||
    raw['height'] <= 0 ||
    typeof raw['baseImageDataUrl'] !== 'string' ||
    !raw['baseImageDataUrl'].startsWith('data:image/') ||
    !Array.isArray(raw['inkCommands'])
  ) {
    return null;
  }

  const inkCommands: InkCommand[] = [];
  for (const cmdRaw of raw['inkCommands']) {
    const cmd = parseInkCommand(cmdRaw);
    if (!cmd) return null;
    inkCommands.push(cmd);
  }

  return {
    id: raw['id'],
    title: raw['title'],
    createdAt: raw['createdAt'],
    updatedAt: raw['updatedAt'],
    width: raw['width'],
    height: raw['height'],
    baseImageDataUrl: raw['baseImageDataUrl'],
    inkCommands,
  };
}

export function encodeBackupBundle(
  worksheets: readonly WorksheetRecord[],
  exportedAt = Date.now(),
): string {
  const bundle: BackupBundle = {
    version: 1,
    exportedAt,
    worksheets,
  };
  return JSON.stringify(bundle, null, 2);
}

export function decodeBackupBundle(jsonText: string): Result<BackupBundle, BackupCodecError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      error: { code: 'INVALID_JSON', message: '備份檔案不是有效的 JSON 格式' },
    };
  }

  if (!isRecord(parsed) || parsed['version'] !== 1 || !isFiniteNumber(parsed['exportedAt'])) {
    return {
      ok: false,
      error: { code: 'INVALID_SCHEMA', message: '備份檔案版本或結構不符' },
    };
  }

  const rawList = parsed['worksheets'];
  if (!Array.isArray(rawList)) {
    return {
      ok: false,
      error: { code: 'INVALID_SCHEMA', message: '備份檔案缺少工作紙清單' },
    };
  }

  const worksheets: WorksheetRecord[] = [];
  for (const item of rawList) {
    const ws = parseWorksheetRecord(item);
    if (!ws) {
      return {
        ok: false,
        error: { code: 'INVALID_SCHEMA', message: '工作紙資料欄位損毀或格式錯誤' },
      };
    }
    worksheets.push(ws);
  }

  return {
    ok: true,
    value: {
      version: 1,
      exportedAt: parsed['exportedAt'],
      worksheets,
    },
  };
}
