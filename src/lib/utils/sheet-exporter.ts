// src/lib/utils/sheet-exporter.ts

export interface SheetOptions {
  dpi?: number;              // 300 DPI for standard photo/print quality
  pageWidthInches?: number;  // 8.5
  pageHeightInches?: number; // 11.0
  marginInches?: number;     // 0.5 in printer margin
  gapMm?: number;            // 2 mm gap between labels
  drawCutGuides?: boolean;   // Dashed border around labels
}

export interface SheetExportResult {
  pageIndex: number;
  canvas: HTMLCanvasElement;
  blob: Blob;
}

const MM_TO_INCH = 1 / 25.4;

export async function renderLabelsToLetterSheet(
  labelCanvases: HTMLCanvasElement[],
  options: SheetOptions = {}
): Promise<SheetExportResult[]> {
  const {
    dpi = 300,
    pageWidthInches = 8.5,
    pageHeightInches = 11.0,
    marginInches = 0.5,
    gapMm = 2,
    drawCutGuides = true
  } = options;

  const pxPerMm = dpi * MM_TO_INCH;
  const pageWidthPx = Math.round(pageWidthInches * dpi);
  const pageHeightPx = Math.round(pageHeightInches * dpi);
  const marginPx = Math.round(marginInches * dpi);
  const gapPx = Math.round(gapMm * pxPerMm);

  const printableWidth = pageWidthPx - marginPx * 2;
  const printableHeight = pageHeightPx - marginPx * 2;

  const pages: HTMLCanvasElement[] = [];

  function createNewPage(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = pageWidthPx;
    canvas.height = pageHeightPx;
    const ctx = canvas.getContext('2d')!;

    // White sheet background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
    pages.push(canvas);
    return { canvas, ctx };
  }

  let { ctx: currentCtx } = createNewPage();

  let cursorX = marginPx;
  let cursorY = marginPx;
  let rowHeight = 0;

  for (const label of labelCanvases) {
    const w = label.width;
    const h = label.height;

    // Check if label overflows horizontal margin
    if (cursorX + w > marginPx + printableWidth && cursorX > marginPx) {
      cursorX = marginPx;
      cursorY += rowHeight + gapPx;
      rowHeight = 0;
    }

    // Check if label overflows vertical margin (paginate if needed)
    if (cursorY + h > marginPx + printableHeight) {
      currentCtx = createNewPage().ctx;
      cursorX = marginPx;
      cursorY = marginPx;
      rowHeight = 0;
    }

    // Draw the label
    currentCtx.drawImage(label, cursorX, cursorY, w, h);

    // Draw dashed cutting marks around the label
    if (drawCutGuides) {
      currentCtx.save();
      currentCtx.strokeStyle = '#D1D5DB'; // Gray border
      currentCtx.lineWidth = 1;
      currentCtx.setLineDash([4, 4]);
      currentCtx.strokeRect(cursorX - 0.5, cursorY - 0.5, w + 1, h + 1);
      currentCtx.restore();
    }

    cursorX += w + gapPx;
    rowHeight = Math.max(rowHeight, h);
  }

  // Convert rendered canvas sheets to PNG Blobs
  const results: SheetExportResult[] = [];
  for (let i = 0; i < pages.length; i++) {
    const canvas = pages[i];
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    results.push({ pageIndex: i + 1, canvas, blob });
  }

  return results;
}
