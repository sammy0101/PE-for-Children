import { renderInkCommands } from '../domain/inkEngine';
import { nextRotation, renderProcessedWorksheetImage } from '../domain/scanProcessor';
import type {
  PenColor,
  RotationDegree,
  ScanFilterMode,
  WorksheetRecord,
} from '../domain/types';
import { decodeBackupBundle, encodeBackupBundle } from '../storage/backupCodec';
import type { WorksheetRepository } from '../storage/worksheetRepo';
import {
  clearControllerInk,
  createInitialCanvasState,
  handlePointerDown,
  handlePointerMove,
  handlePointerUpOrCancel,
  undoControllerInk,
  type CanvasControllerState,
} from './canvasController';

interface ScanDraft {
  readonly sourceUrl: string;
  readonly previewUrl: string;
  readonly width: number;
  readonly height: number;
  readonly rotationDeg: RotationDegree;
  readonly filter: ScanFilterMode;
  readonly title: string;
}

type ViewState =
  | { readonly screen: 'library'; readonly worksheets: readonly WorksheetRecord[] }
  | {
      readonly screen: 'practice';
      readonly worksheet: WorksheetRecord;
      readonly canvasState: CanvasControllerState;
      readonly zoomScale: number;
    };

const PEN_COLORS: readonly { readonly hex: PenColor; readonly label: string }[] = [
  { hex: '#111827', label: '黑' },
  { hex: '#2563eb', label: '藍' },
  { hex: '#dc2626', label: '紅' },
  { hex: '#16a34a', label: '綠' },
];

function isStandalonePwa(): boolean {
  const matchStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const navStandalone =
    'standalone' in navigator &&
    (navigator as { readonly standalone?: boolean }).standalone === true;
  return matchStandalone || navStandalone;
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

export async function mountApp(
  root: HTMLElement,
  repo: WorksheetRepository,
): Promise<void> {
  let state: ViewState = {
    screen: 'library',
    worksheets: await repo.listWorksheets(),
  };
  let scanDraft: ScanDraft | null = null;
  let showClearConfirm = false;
  let dismissPwaBanner = false;
  let statusMessage: string | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let rafId: number | null = null;

  const setStatus = (msg: string): void => {
    statusMessage = msg;
    render();
    window.setTimeout(() => {
      if (statusMessage === msg) {
        statusMessage = null;
        render();
      }
    }, 3200);
  };

  const cleanupObservers = (): void => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const renderLibrary = (): void => {
    cleanupObservers();
    if (state.screen !== 'library') return;

    const showSafariTip = !isStandalonePwa() && !dismissPwaBanner;

    root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div>
            <h1>工作紙練習本</h1>
            <p class="subtitle">雙層保護：隨時手寫、擦除與重練，底圖永遠保留</p>
          </div>
          <div class="topbar-actions">
            <button type="button" class="btn btn-secondary" data-action="export-backup">匯出備份</button>
            <button type="button" class="btn btn-secondary" data-action="trigger-import">匯入備份</button>
            <input type="file" accept="application/json,.json" hidden data-input="import-json" />
          </div>
        </header>

        ${
          showSafariTip
            ? `<div class="pwa-banner" role="note">
                <span>💡 <strong>iPad 建議：</strong>請點選 Safari 分享按鈕 →「<strong>加入主畫面</strong>」，即可全螢幕書寫並防止瀏覽器 7 天未開啟自動清除資料。</span>
                <button type="button" class="btn-icon" data-action="dismiss-banner" aria-label="關閉提示">✕</button>
              </div>`
            : ''
        }

        ${statusMessage ? `<div class="toast">${statusMessage}</div>` : ''}

        <section class="scan-card">
          <div class="scan-actions">
            <label class="btn btn-primary btn-lg">
              📷 拍照掃瞄工作紙
              <input type="file" accept="image/*" capture="environment" hidden data-input="camera-scan" />
            </label>
            <label class="btn btn-outline btn-lg">
              🖼️ 從相簿 / 檔案選圖
              <input type="file" accept="image/*" hidden data-input="album-scan" />
            </label>
          </div>
        </section>

        <section class="library-grid">
          ${
            state.worksheets.length === 0
              ? `<div class="empty-state">目前還沒有儲存的工作紙，請先拍照或從相簿匯入一張工作紙開始練習！</div>`
              : state.worksheets
                  .map(
                    (ws) => `
                  <article class="ws-card">
                    <button type="button" class="ws-thumb-btn" data-action="open-ws" data-id="${ws.id}">
                      <img src="${ws.baseImageDataUrl}" alt="${ws.title}" loading="lazy" />
                    </button>
                    <div class="ws-meta">
                      <div class="ws-title">${escapeHtml(ws.title)}</div>
                      <div class="ws-info">筆跡：${ws.inkCommands.length} 筆 · 更新於 ${formatDate(ws.updatedAt)}</div>
                      <div class="ws-card-actions">
                        <button type="button" class="btn btn-primary btn-sm" data-action="open-ws" data-id="${ws.id}">開始練習</button>
                        <button type="button" class="btn btn-danger-ghost btn-sm" data-action="delete-ws" data-id="${ws.id}">刪除</button>
                      </div>
                    </div>
                  </article>
                `,
                  )
                  .join('')
          }
        </section>

        ${scanDraft ? renderScanModalHtml(scanDraft) : ''}
      </div>
    `;

    bindLibraryEvents();
  };

  const renderScanModalHtml = (draft: ScanDraft): string => `
    <div class="modal-backdrop">
      <div class="modal-card">
        <h2>預覽掃瞄工作紙</h2>
        <div class="scan-preview-box">
          <img src="${draft.previewUrl}" alt="掃瞄預覽" />
        </div>
        <div class="scan-controls">
          <button type="button" class="btn btn-secondary" data-action="rotate-draft">↻ 旋轉 90°</button>
          <button type="button" class="btn ${draft.filter === 'high-contrast' ? 'btn-primary' : 'btn-secondary'}" data-action="toggle-filter">
            ${draft.filter === 'high-contrast' ? '✓ 掃瞄高對比增強中' : '切換黑白高對比'}
          </button>
        </div>
        <label class="field-label">
          工作紙名稱
          <input type="text" class="text-input" value="${escapeHtml(draft.title)}" data-input="draft-title" />
        </label>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-action="cancel-draft">取消</button>
          <button type="button" class="btn btn-primary" data-action="save-draft">儲存並開始練習</button>
        </div>
      </div>
    </div>
  `;

  const handleFilePicked = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    try {
      const processed = await renderProcessedWorksheetImage(objectUrl, 0, 'high-contrast');
      scanDraft = {
        sourceUrl: objectUrl,
        previewUrl: processed.dataUrl,
        width: processed.width,
        height: processed.height,
        rotationDeg: 0,
        filter: 'high-contrast',
        title: `工作紙 ${formatDate(Date.now())}`,
      };
      render();
    } catch {
      URL.revokeObjectURL(objectUrl);
      setStatus('圖片讀取失敗，請重新選擇圖片');
    }
  };

  const updateScanDraft = async (
    rotationDeg: RotationDegree,
    filter: ScanFilterMode,
  ): Promise<void> => {
    if (!scanDraft) return;
    const processed = await renderProcessedWorksheetImage(
      scanDraft.sourceUrl,
      rotationDeg,
      filter,
    );
    scanDraft = {
      ...scanDraft,
      rotationDeg,
      filter,
      previewUrl: processed.dataUrl,
      width: processed.width,
      height: processed.height,
    };
    render();
  };

  const bindLibraryEvents = (): void => {
    const cameraInput = root.querySelector<HTMLInputElement>('[data-input="camera-scan"]');
    const albumInput = root.querySelector<HTMLInputElement>('[data-input="album-scan"]');
    const importInput = root.querySelector<HTMLInputElement>('[data-input="import-json"]');

    cameraInput?.addEventListener('change', () => {
      void handleFilePicked(cameraInput.files?.[0]);
    });
    albumInput?.addEventListener('change', () => {
      void handleFilePicked(albumInput.files?.[0]);
    });

    root.querySelector('[data-action="dismiss-banner"]')?.addEventListener('click', () => {
      dismissPwaBanner = true;
      render();
    });

    root.querySelector('[data-action="export-backup"]')?.addEventListener('click', async () => {
      const all = await repo.listWorksheets();
      const json = encodeBackupBundle(all);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worksheets-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`已匯出 ${all.length} 份工作紙備份`);
    });

    root.querySelector('[data-action="trigger-import"]')?.addEventListener('click', () => {
      importInput?.click();
    });

    importInput?.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const text = await file.text();
      const decoded = decodeBackupBundle(text);
      if (!decoded.ok) {
        setStatus(decoded.error.message);
        return;
      }
      const count = await repo.importWorksheets(decoded.value.worksheets);
      state = { screen: 'library', worksheets: await repo.listWorksheets() };
      setStatus(`成功匯入 ${count} 份工作紙`);
    });

    root.querySelectorAll<HTMLElement>('[data-action="open-ws"]').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.dataset['id'];
        if (!id) return;
        const ws = await repo.getWorksheet(id);
        if (!ws) return;
        state = {
          screen: 'practice',
          worksheet: ws,
          canvasState: createInitialCanvasState(ws.inkCommands, false),
          zoomScale: 1,
        };
        render();
      });
    });

    root.querySelectorAll<HTMLElement>('[data-action="delete-ws"]').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.dataset['id'];
        if (!id) return;
        if (!window.confirm('確定要永久刪除這份工作紙（包含底圖與筆跡）嗎？')) return;
        await repo.deleteWorksheet(id);
        state = { screen: 'library', worksheets: await repo.listWorksheets() };
        setStatus('已刪除工作紙');
      });
    });

    // Scan Modal events
    root.querySelector('[data-action="rotate-draft"]')?.addEventListener('click', () => {
      if (!scanDraft) return;
      void updateScanDraft(nextRotation(scanDraft.rotationDeg), scanDraft.filter);
    });

    root.querySelector('[data-action="toggle-filter"]')?.addEventListener('click', () => {
      if (!scanDraft) return;
      const nextFilter: ScanFilterMode =
        scanDraft.filter === 'high-contrast' ? 'original' : 'high-contrast';
      void updateScanDraft(scanDraft.rotationDeg, nextFilter);
    });

    root.querySelector<HTMLInputElement>('[data-input="draft-title"]')?.addEventListener('input', (e) => {
      if (!scanDraft) return;
      const target = e.currentTarget as HTMLInputElement;
      scanDraft = { ...scanDraft, title: target.value };
    });

    root.querySelector('[data-action="cancel-draft"]')?.addEventListener('click', () => {
      if (scanDraft) URL.revokeObjectURL(scanDraft.sourceUrl);
      scanDraft = null;
      render();
    });

    root.querySelector('[data-action="save-draft"]')?.addEventListener('click', async () => {
      if (!scanDraft) return;
      const now = Date.now();
      const record: WorksheetRecord = {
        id: generateId('ws'),
        title: scanDraft.title.trim() || `工作紙 ${formatDate(now)}`,
        createdAt: now,
        updatedAt: now,
        width: scanDraft.width,
        height: scanDraft.height,
        baseImageDataUrl: scanDraft.previewUrl,
        inkCommands: [],
      };
      await repo.saveWorksheet(record);
      URL.revokeObjectURL(scanDraft.sourceUrl);
      scanDraft = null;
      state = {
        screen: 'practice',
        worksheet: record,
        canvasState: createInitialCanvasState([], false),
        zoomScale: 1,
      };
      render();
    });
  };

  const renderPractice = (): void => {
    cleanupObservers();
    if (state.screen !== 'practice') return;
    const { worksheet, canvasState, zoomScale } = state;
    const isPen = canvasState.tool.kind === 'pen';
    const currentColor = canvasState.tool.kind === 'pen' ? canvasState.tool.color : null;
    const currentWidth = canvasState.tool.widthRatio;

    root.innerHTML = `
      <div class="practice-shell">
        <header class="practice-toolbar">
          <div class="tool-group">
            <button type="button" class="btn btn-secondary" data-action="back-library">← 返回</button>
            <span class="practice-title">${escapeHtml(worksheet.title)}</span>
          </div>

          <div class="tool-group">
            <button type="button" class="btn ${isPen ? 'btn-primary' : 'btn-secondary'}" data-action="tool-pen">✏️ 畫筆</button>
            <button type="button" class="btn ${!isPen ? 'btn-primary' : 'btn-secondary'}" data-action="tool-erase">🧽 橡皮擦</button>
          </div>

          <div class="tool-group color-group">
            ${PEN_COLORS.map(
              (c) => `
              <button
                type="button"
                class="color-dot ${currentColor === c.hex ? 'active' : ''}"
                style="background:${c.hex}"
                aria-label="筆色 ${c.label}"
                data-action="pick-color"
                data-color="${c.hex}"
              ></button>
            `,
            ).join('')}
            <button type="button" class="btn btn-sm ${isPen && currentWidth < 0.006 ? 'btn-primary' : 'btn-secondary'}" data-action="width-thin">細</button>
            <button type="button" class="btn btn-sm ${isPen && currentWidth >= 0.006 ? 'btn-primary' : 'btn-secondary'}" data-action="width-thick">粗</button>
          </div>

          <div class="tool-group">
            <button
              type="button"
              class="btn ${canvasState.pencilOnlyMode ? 'btn-primary' : 'btn-secondary'}"
              data-action="toggle-pencil-only"
              title="開啟後僅接受 Apple Pencil，手掌靠在螢幕上也不會誤畫"
            >
              ${canvasState.pencilOnlyMode ? '✒️ 僅 Pencil (防誤觸開)' : '👆 筆與手指皆可'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="zoom-out">－</button>
            <span class="zoom-label">${Math.round(zoomScale * 100)}%</span>
            <button type="button" class="btn btn-secondary btn-sm" data-action="zoom-in">＋</button>
          </div>

          <div class="tool-group">
            <button type="button" class="btn btn-secondary" data-action="undo" ${canvasState.commands.length === 0 ? 'disabled' : ''}>↩ 上一步</button>
            <button type="button" class="btn btn-danger" data-action="ask-clear" ${canvasState.commands.length === 0 ? 'disabled' : ''}>🗑️ 一鍵清除</button>
          </div>
        </header>

        <main class="canvas-viewport">
          <div class="canvas-stage" style="width: ${Math.round(zoomScale * 100)}%; max-width: ${Math.round(920 * zoomScale)}px; aspect-ratio: ${worksheet.width} / ${worksheet.height};">
            <img class="worksheet-base" src="${worksheet.baseImageDataUrl}" alt="${escapeHtml(worksheet.title)}" draggable="false" />
            <canvas class="ink-canvas"></canvas>
          </div>
        </main>

        ${
          showClearConfirm
            ? `<div class="modal-backdrop">
                <div class="modal-card modal-sm">
                  <h2>一鍵清除全部手寫內容？</h2>
                  <p>這將會清空目前這張工作紙上的所有手寫筆跡，但<strong>原本的題目底圖會完整保留</strong>。</p>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-action="cancel-clear">取消</button>
                    <button type="button" class="btn btn-danger" data-action="confirm-clear">確定全部清除</button>
                  </div>
                </div>
              </div>`
            : ''
        }
      </div>
    `;

    bindPracticeEvents();
  };

  const bindPracticeEvents = (): void => {
    const canvas = root.querySelector<HTMLCanvasElement>('.ink-canvas');
    const stage = root.querySelector<HTMLElement>('.canvas-stage');
    if (!canvas || !stage || state.screen !== 'practice') return;

    const redrawCanvas = (): void => {
      if (state.screen !== 'practice') return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pixelW = Math.round(rect.width * dpr);
      const pixelH = Math.round(rect.height * dpr);
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const allCommands = state.canvasState.activeCommand
        ? [...state.canvasState.commands, state.canvasState.activeCommand]
        : state.canvasState.commands;

      renderInkCommands(ctx, allCommands, { width: rect.width, height: rect.height });
    };

    const scheduleRedraw = (): void => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        redrawCanvas();
      });
    };

    redrawCanvas();
    resizeObserver = new ResizeObserver(() => redrawCanvas());
    resizeObserver.observe(stage);

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (state.screen !== 'practice') return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const nextCanvasState = handlePointerDown(
        state.canvasState,
        {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          clientX: e.clientX,
          clientY: e.clientY,
          pressure: e.pressure,
        },
        rect,
        generateId('ink'),
      );
      if (nextCanvasState !== state.canvasState) {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // 忽略部分瀏覽器模擬事件不支援 capture 的情況
        }
        state = { ...state, canvasState: nextCanvasState };
        scheduleRedraw();
      }
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (state.screen !== 'practice') return;
      if (state.canvasState.activePointerId !== e.pointerId) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const nextCanvasState = handlePointerMove(
        state.canvasState,
        {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          clientX: e.clientX,
          clientY: e.clientY,
          pressure: e.pressure,
        },
        rect,
      );
      state = { ...state, canvasState: nextCanvasState };
      scheduleRedraw();
    });

    const finishStroke = async (e: PointerEvent): Promise<void> => {
      if (state.screen !== 'practice') return;
      const { nextState, committed } = handlePointerUpOrCancel(
        state.canvasState,
        e.pointerId,
      );
      if (!committed) return;

      state = { ...state, canvasState: nextState };
      redrawCanvas();
      const updated = await repo.updateInkCommands(
        state.worksheet.id,
        nextState.commands,
      );
      if (updated && state.screen === 'practice') {
        state = { ...state, worksheet: updated };
      }
      // 更新工具列按鈕 disabled 狀態
      updateUndoClearButtons();
    };

    canvas.addEventListener('pointerup', (e: PointerEvent) => void finishStroke(e));
    canvas.addEventListener('pointercancel', (e: PointerEvent) => void finishStroke(e));

    const updateUndoClearButtons = (): void => {
      if (state.screen !== 'practice') return;
      const empty = state.canvasState.commands.length === 0;
      const undoBtn = root.querySelector<HTMLButtonElement>('[data-action="undo"]');
      const clearBtn = root.querySelector<HTMLButtonElement>('[data-action="ask-clear"]');
      if (undoBtn) undoBtn.disabled = empty;
      if (clearBtn) clearBtn.disabled = empty;
    };

    root.querySelector('[data-action="back-library"]')?.addEventListener('click', async () => {
      showClearConfirm = false;
      state = { screen: 'library', worksheets: await repo.listWorksheets() };
      render();
    });

    root.querySelector('[data-action="tool-pen"]')?.addEventListener('click', () => {
      if (state.screen !== 'practice') return;
      const prevColor = state.canvasState.tool.kind === 'pen' ? state.canvasState.tool.color : '#2563eb';
      state = {
        ...state,
        canvasState: {
          ...state.canvasState,
          tool: { kind: 'pen', color: prevColor, widthRatio: 0.0045 },
        },
      };
      render();
    });

    root.querySelector('[data-action="tool-erase"]')?.addEventListener('click', () => {
      if (state.screen !== 'practice') return;
      state = {
        ...state,
        canvasState: {
          ...state.canvasState,
          tool: { kind: 'erase', widthRatio: 0.032 },
        },
      };
      render();
    });

    root.querySelectorAll<HTMLElement>('[data-action="pick-color"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.screen !== 'practice') return;
        const color = btn.dataset['color'] as PenColor | undefined;
        if (!color) return;
        const widthRatio =
          state.canvasState.tool.kind === 'pen' ? state.canvasState.tool.widthRatio : 0.0045;
        state = {
          ...state,
          canvasState: {
            ...state.canvasState,
            tool: { kind: 'pen', color, widthRatio },
          },
        };
        render();
      });
    });

    root.querySelector('[data-action="width-thin"]')?.addEventListener('click', () => {
      if (state.screen !== 'practice') return;
      const color = state.canvasState.tool.kind === 'pen' ? state.canvasState.tool.color : '#2563eb';
      state = {
        ...state,
        canvasState: {
          ...state.canvasState,
          tool: { kind: 'pen', color, widthRatio: 0.0038 },
        },
      };
      render();
    });

    root.querySelector('[data-action="width-thick"]')?.addEventListener('click', () => {
      if (state.screen !== 'practice') return;
      const color = state.canvasState.tool.kind === 'pen' ? state.canvasState.tool.color : '#2563eb';
      state = {
        ...state,
        canvasState: {
          ...state.canvasState,
          tool: { kind: 'pen', color, widthRatio: 0.0085 },
        },
      };
      render();
    });

    root.querySelector('[data-action="toggle-pencil-only"]')?.addEventListener('click', () => {
      if (state.screen !== 'practice') return;
      state = {
        ...state,
        canvasState: {
          ...state.canvasState,
          pencilOnlyMode: !state.canvasState.pencilOnlyMode,
        },
      };
      render();
    });

    root.querySelector('[data-action="zoom-in"]')?.addEventListener('click', () => {
      if (state.screen !== 'practice') return;
      state = { ...state, zoomScale: Math.min(2, Number((state.zoomScale + 0.25).toFixed(2))) };
      render();
    });

    root.querySelector('[data-action="zoom-out"]')?.addEventListener('click', () => {
      if (state.screen !== 'practice') return;
      state = { ...state, zoomScale: Math.max(0.75, Number((state.zoomScale - 0.25).toFixed(2))) };
      render();
    });

    root.querySelector('[data-action="undo"]')?.addEventListener('click', async () => {
      if (state.screen !== 'practice') return;
      const nextCanvas = undoControllerInk(state.canvasState);
      state = { ...state, canvasState: nextCanvas };
      const updated = await repo.updateInkCommands(state.worksheet.id, nextCanvas.commands);
      if (updated && state.screen === 'practice') {
        state = { ...state, worksheet: updated };
      }
      render();
    });

    root.querySelector('[data-action="ask-clear"]')?.addEventListener('click', () => {
      showClearConfirm = true;
      render();
    });

    root.querySelector('[data-action="cancel-clear"]')?.addEventListener('click', () => {
      showClearConfirm = false;
      render();
    });

    root.querySelector('[data-action="confirm-clear"]')?.addEventListener('click', async () => {
      if (state.screen !== 'practice') return;
      showClearConfirm = false;
      const nextCanvas = clearControllerInk(state.canvasState);
      state = { ...state, canvasState: nextCanvas };
      const updated = await repo.updateInkCommands(state.worksheet.id, nextCanvas.commands);
      if (updated && state.screen === 'practice') {
        state = { ...state, worksheet: updated };
      }
      render();
    });
  };

  const render = (): void => {
    if (state.screen === 'library') {
      renderLibrary();
    } else {
      renderPractice();
    }
  };

  render();
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
