import { describe, expect, it } from 'vitest';
import type { WorksheetRecord } from '../src/domain/types';
import { decodeBackupBundle, encodeBackupBundle } from '../src/storage/backupCodec';

describe('backupCodec', () => {
  it('round-trips a valid BackupBundle cleanly', () => {
    const sample: WorksheetRecord = {
      id: 'ws_1',
      title: '數學加減法',
      createdAt: 1000,
      updatedAt: 2000,
      width: 1200,
      height: 1600,
      baseImageDataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
      inkCommands: [
        {
          kind: 'pen',
          id: 'ink_1',
          color: '#2563eb',
          widthRatio: 0.005,
          points: [{ x: 0.2, y: 0.3, pressure: 0.6 }],
        },
      ],
    };

    const json = encodeBackupBundle([sample], 3000);
    const decoded = decodeBackupBundle(json);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.worksheets).toEqual([sample]);
      expect(decoded.value.exportedAt).toBe(3000);
    }
  });

  it('rejects malformed JSON and invalid image URLs without throwing', () => {
    const badJson = decodeBackupBundle('{bad');
    expect(badJson.ok).toBe(false);

    const badSchema = decodeBackupBundle(
      JSON.stringify({
        version: 1,
        exportedAt: 100,
        worksheets: [
          {
            id: 'ws_bad',
            title: 'x',
            createdAt: 1,
            updatedAt: 1,
            width: 100,
            height: 100,
            baseImageDataUrl: 'javascript:alert(1)',
            inkCommands: [],
          },
        ],
      }),
    );
    expect(badSchema.ok).toBe(false);
  });
});
