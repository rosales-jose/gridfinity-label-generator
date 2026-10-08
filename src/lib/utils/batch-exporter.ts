/**
 * Batch Tape & Sheet PNG Export Utility
 *
 * Exports batch labels to high-quality PNG files for tape printers
 * or standard 8.5" x 11" (US Letter) sheet printing.
 */

import { renderBatchTape } from './batch-renderer';
import type { BatchRenderData } from '$lib/types/batch';

export interface BatchExportOptions {
	batch: BatchRenderData;
	dpi?: number;
}

export interface BatchSheetExportOptions {
	batch: BatchRenderData;
	dpi?: number;              // Standard 300 DPI for sheet print
	pageWidthInches?: number;  // 8.5
	pageHeightInches?: number; // 11.0
	marginInches?: number;     // 0.5 in printer margin
	gapMm?: number;            // Gap between labels (default 2mm)
	drawCutGuides?: boolean;   // Dashed cut lines around labels
}

const DEFAULT_TAPE_DPI = 360;
const DEFAULT_SHEET_DPI = 300;
const MM_TO_INCH = 1 / 25.4;

/**
 * Exports a batch tape to PNG format using canvas (Continuous Ribbon)
 */
export async function exportBatchTapeAsPNG(options: BatchExportOptions): Promise<void> {
	const { batch, dpi = DEFAULT_TAPE_DPI } = options;

	// Validate batch has labels
	if (batch.labels.length === 0) {
		throw new Error('Cannot export empty batch');
	}

	// Create high-res canvas for export
	const exportCanvas = document.createElement('canvas');

	// Render batch tape to canvas
	try {
		await renderBatchTape({
			canvas: exportCanvas,
			batch,
			dpi,
			showMargins: false // No margins in export
		});
	} catch (error) {
		if (import.meta.env.DEV) {
			console.error('Failed to render batch tape:', error);
		}
		throw error;
	}

	// Generate filename with timestamp
	const filename = generateBatchFilename(batch.labels.length);

	// Download the canvas
	await downloadCanvasAsPng(exportCanvas, filename);
}

/**
 * Exports batch labels packed into an 8.5" x 11" (US Letter) sheet
 */
export async function exportBatchSheetAsPNG(options: BatchSheetExportOptions): Promise<void> {
	const {
		batch,
		dpi = DEFAULT_SHEET_DPI,
		pageWidthInches = 8.5,
		pageHeightInches = 11.0,
		marginInches = 0.5,
		gapMm = 2,
		drawCutGuides = true
	} = options;

	if (batch.labels.length === 0) {
		throw new Error('Cannot export empty batch');
	}

	const pxPerMm = dpi * MM_TO_INCH;
	const pageWidthPx = Math.round(pageWidthInches * dpi);
	const pageHeightPx = Math.round(pageHeightInches * dpi);
	const marginPx = Math.round(marginInches * dpi);
	const gapPx = Math.round(gapMm * pxPerMm);

	const printableWidth = pageWidthPx - marginPx * 2;
	const printableHeight = pageHeightPx - marginPx * 2;

	// 1. Render each label individually onto a temporary canvas
	const labelCanvases: HTMLCanvasElement[] = [];
	for (const label of batch.labels) {
		const tempCanvas = document.createElement('canvas');
		await renderBatchTape({
			canvas: tempCanvas,
			batch: {
				...batch,
				labels: [label]
			},
			dpi,
			showMargins: false
		});
		labelCanvases.push(tempCanvas);
	}

	// 2. Setup sheet pages collection
	const sheetCanvases: HTMLCanvasElement[] = [];

	function createSheetCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
		const canvas = document.createElement('canvas');
		canvas.width = pageWidthPx;
		canvas.height = pageHeightPx;
		const ctx = canvas.getContext('2d')!;

		// Clean white paper background
		ctx.fillStyle = '#FFFFFF';
		ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);

		sheetCanvases.push(canvas);
		return { canvas, ctx };
	}

	let { ctx: currentCtx } = createSheetCanvas();
	let cursorX = marginPx;
	let cursorY = marginPx;
	let rowHeight = 0;

	// 3. Pack labels into the grid across rows and pages
	for (const labelCanvas of labelCanvases) {
		const w = labelCanvas.width;
		const h = labelCanvas.height;

		// Wrap to new row if label exceeds printable width
		if (cursorX + w > marginPx + printableWidth && cursorX > marginPx) {
			cursorX = marginPx;
			cursorY += rowHeight + gapPx;
			rowHeight = 0;
		}

		// Paginate to new sheet if label exceeds printable height
		if (cursorY + h > marginPx + printableHeight) {
			currentCtx = createSheetCanvas().ctx;
			cursorX = marginPx;
			cursorY = marginPx;
			rowHeight = 0;
		}

		// Draw the label
		currentCtx.drawImage(labelCanvas, cursorX, cursorY, w, h);

		// Draw optional cutting outline
		if (drawCutGuides) {
			currentCtx.save();
			currentCtx.strokeStyle = '#D1D5DB'; // Light gray cut line
			currentCtx.lineWidth = 1;
			currentCtx.setLineDash([4, 4]); // Dashed
			currentCtx.strokeRect(cursorX - 0.5, cursorY - 0.5, w + 1, h + 1);
			currentCtx.restore();
		}

		cursorX += w + gapPx;
		rowHeight = Math.max(rowHeight, h);
	}

	// 4. Download each page
	for (let i = 0; i < sheetCanvases.length; i++) {
		const filename = generateBatchSheetFilename(i + 1, sheetCanvases.length, batch.labels.length);
		await downloadCanvasAsPng(sheetCanvases[i], filename);

		// Small delay between multiple downloads to avoid browser popup blocks
		if (sheetCanvases.length > 1 && i < sheetCanvases.length - 1) {
			await new Promise((r) => setTimeout(r, 400));
		}
	}
}

/**
 * Generates filename for 8.5" x 11" sheets
 */
function generateBatchSheetFilename(page: number, totalPages: number, labelCount: number): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	const pageSuffix = totalPages > 1 ? `_page${page}of${totalPages}` : '';
	return `batch_letter_${year}${month}${day}_${hours}${minutes}${seconds}_${labelCount}labels${pageSuffix}.png`;
}

/**
 * Generates filename with timestamp
 * Format: batch_{timestamp}.png (e.g., batch_20250102_143052.png)
 */
function generateBatchFilename(labelCount: number): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return `batch_${year}${month}${day}_${hours}${minutes}${seconds}_${labelCount}labels.png`;
}

/**
 * Downloads canvas content as PNG file
 */
function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): Promise<void> {
	// Check if we're in a browser environment
	if (typeof document === 'undefined' || !document.body) {
		if (import.meta.env.DEV) {
			console.error('Download not available - not in browser environment');
		}
		return Promise.reject(new Error('Download not available in this environment'));
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				if (import.meta.env.DEV) {
					console.error('Failed to create PNG blob');
				}
				reject(new Error('Failed to create PNG blob'));
				return;
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.style.display = 'none';
			document.body.appendChild(a);

			// Use requestAnimationFrame to ensure the link is in the DOM and browser is ready
			requestAnimationFrame(() => {
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				resolve();
			});
		}, 'image/png');
	});
}
