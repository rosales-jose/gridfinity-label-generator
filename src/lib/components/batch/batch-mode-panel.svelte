<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { batchStore } from '$lib/stores/batch-store';
	import { exportBatchTapeAsPNG, exportBatchSheetAsPNG } from '$lib/utils/batch-exporter';
	import BatchLabelList from './batch-label-list.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ListIcon from '@lucide/svelte/icons/list';

	let batchState = $derived($batchStore);
	let canExport = $derived(batchState.labels.length > 0);

	let isExporting = $state(false);
	let exportStatus = $state('');

	// Export Layout Options
	let exportFormat = $state<'letter' | 'tape'>('letter');
	let includeCutGuides = $state(true);

	async function handleExport() {
		if (!canExport) return;

		isExporting = true;
		exportStatus = '';

		try {
			if (exportFormat === 'tape') {
				// Original continuous tape export
				await exportBatchTapeAsPNG({
					batch: batchState
				});
				exportStatus = `✓ Exported ${batchState.labels.length} labels as tape strip`;
			} else {
				// 8.5" x 11" Sheet export (at 300 DPI)
				await exportBatchSheetAsPNG({
					batch: batchState,
					pageWidthInches: 8.5,
					pageHeightInches: 11.0,
					marginInches: 0.5,
					drawCutGuides: includeCutGuides,
					dpi: 300
				});
				exportStatus = `✓ Exported ${batchState.labels.length} labels to 8.5"×11" sheet`;
			}

			setTimeout(() => {
				exportStatus = '';
			}, 3000);
		} catch (error) {
			console.error('Export failed:', error);
			exportStatus = '✗ Export failed';
			setTimeout(() => {
				exportStatus = '';
			}, 3000);
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="w-full">
	<div class="mb-6 border-t border-slate-800/80 pt-8">
		<h2 class="text-2xl font-black tracking-tight text-white">Batch Labels</h2>
		<p class="mt-1 text-sm text-slate-400">Manage your label collection before exporting.</p>
	</div>

	{#if batchState.labels.length === 0}
		<div
			class="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/50 p-8 text-center backdrop-blur"
			data-testid="batch-empty-state"
		>
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
				<ListIcon class="h-7 w-7 text-slate-600" />
			</div>
			<p class="text-lg font-bold text-slate-300">No labels in batch</p>
			<p class="mt-2 text-sm text-slate-500">
				Configure a label in the sidebar and click "Add Current Label"
			</p>
		</div>
	{:else}
		<div class="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-4">
			<BatchLabelList />
		</div>

		<div class="mt-10 flex flex-col items-center gap-5 pb-8">
			<!-- Export Format Selection Card -->
			<div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left shadow-lg backdrop-blur">
				<label class="block text-xs font-bold tracking-wider text-slate-400 uppercase">
					Export Layout
				</label>
				
				<div class="mt-3 grid grid-cols-2 gap-3">
					<button
						type="button"
						onclick={() => (exportFormat = 'letter')}
						class="flex flex-col items-start gap-1 rounded-xl border p-3 transition-all {exportFormat === 'letter'
							? 'border-cyan-500 bg-cyan-950/30 text-white shadow-sm'
							: 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
					>
						<span class="text-xs font-bold">8.5" × 11" Paper</span>
						<span class="text-[11px] text-slate-400">US Letter Grid Sheet</span>
					</button>

					<button
						type="button"
						onclick={() => (exportFormat = 'tape')}
						class="flex flex-col items-start gap-1 rounded-xl border p-3 transition-all {exportFormat === 'tape'
							? 'border-cyan-500 bg-cyan-950/30 text-white shadow-sm'
							: 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'}"
					>
						<span class="text-xs font-bold">Continuous Tape</span>
						<span class="text-[11px] text-slate-400">Label Maker Strip</span>
					</button>
				</div>

				{#if exportFormat === 'letter'}
					<div class="mt-3.5 flex items-center gap-2 border-t border-slate-800/80 pt-3">
						<input
							type="checkbox"
							id="cut-guides"
							bind:checked={includeCutGuides}
							class="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
						/>
						<label for="cut-guides" class="text-xs text-slate-300 cursor-pointer">
							Include dashed cutting guides around labels
						</label>
					</div>
				{/if}
			</div>

			<!-- Export Button -->
			<Button
				onclick={handleExport}
				disabled={!canExport || isExporting}
				variant="default"
				size="lg"
				class="h-auto gap-2 rounded-xl px-8 py-4 text-sm font-bold shadow-lg shadow-cyan-500/25 transition-shadow hover:shadow-[0_0_30px_rgba(6,182,212,0.45)]"
				data-testid="export-button"
			>
				<DownloadIcon class="h-5 w-5" />
				{#if isExporting}
					Exporting...
				{:else if exportFormat === 'letter'}
					Export Batch ({batchState.labels.length}) to 8.5" × 11" Paper
				{:else}
					Export Batch ({batchState.labels.length}) as a Single Strip
				{/if}
			</Button>

			<p class="max-w-md text-center text-sm text-slate-500">
				{#if exportFormat === 'letter'}
					Generates a 300 DPI US Letter sheet sized for standard desktop printers (print at 100% scale).
				{:else}
					Exports a single continuous PNG file containing all labels side-by-side for tape printers.
				{/if}
			</p>

			{#if exportStatus}
				<p
					class="text-center text-sm {exportStatus.startsWith('✓')
						? 'text-emerald-400'
						: 'text-destructive'}"
				>
					{exportStatus}
				</p>
			{/if}
		</div>
	{/if}
</div>
