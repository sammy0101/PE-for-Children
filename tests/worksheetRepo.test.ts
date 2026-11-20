import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { WorksheetRecord } from '../src/domain/types';
import { createWorksheetRepo } from '../src/storage/worksheetRepo';

describe('worksheetRepo (IndexedDB)', () => {
  it('saves, updates ink without mutating baseImageDataUrl, and clears ink', async () => {
    const repo = createWorksheetRepo(new IDBFactory());
    const initial: WorksheetRecord = {
      id: 'ws_math',
      title: '九九乘法',
      createdAt: 100,
      updatedAt: 100,
      width: 800,
      height: 1000,
      baseImageDataUrl: 'data:image/jpeg;base64,ORIGINAL_BASE',
      inkCommands: [],
    };

    await repo.saveWorksheet(initial);
    const updated = await repo.updateInkCommands(
      'ws_math',
      [
        {
          kind: 'pen',
          id: 's1',
          color: '#111827',
          widthRatio: 0.005,
          points: [{ x: 0.5, y: 0.5, pressure: 0.5 }],
        },
      ],
      200,
    );

    expect(updated?.inkCommands).toHaveLength(1);
    expect(updated?.baseImageDataUrl).toBe('data:image/jpeg;base64,ORIGINAL_BASE');

    const cleared = await repo.updateInkCommands('ws_math', [], 300);
    expect(cleared?.inkCommands).toEqual([]);
    expect(cleared?.baseImageDataUrl).toBe('data:image/jpeg;base64,ORIGINAL_BASE');

    const listed = await repo.listWorksheets();
    expect(listed).toHaveLength(1);
  });
});
