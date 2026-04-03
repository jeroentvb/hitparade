<script lang="ts">
	import { categoryColor, categoryShortLabel } from './categoryColors';
	import type { CategorySlug } from '$lib/categories';

	let {
		cells,
		eligibleCells = [],
		onplace = null,
		winningLine = null
	}: {
		cells: { category: CategorySlug; marked: boolean }[];
		eligibleCells?: number[];
		onplace?: ((index: number) => void) | null;
		winningLine?: number[] | null;
	} = $props();

	const isInteractive = $derived(onplace !== null && eligibleCells.length > 0);
</script>

<div class="mx-auto grid w-fit grid-cols-5 gap-1.5">
	{#each cells as cell, i (i)}
		{@const color = categoryColor(cell.category)}
		{@const isEligible = eligibleCells.includes(i)}
		{@const isWinning = winningLine?.includes(i) ?? false}
		{#if isInteractive && isEligible && !cell.marked}
			<button
				class="relative flex h-14 w-14 items-center justify-center rounded-lg border-2 text-xs font-bold transition-all {color.border} {color.bg} ring-2 {color.glow} animate-pulse opacity-90 hover:opacity-100"
				onclick={() => onplace?.(i)}
			>
				{categoryShortLabel(cell.category)}
			</button>
		{:else}
			<div
				class="relative flex h-14 w-14 items-center justify-center rounded-lg border text-xs font-bold
					{cell.marked
					? isWinning
						? 'border-yellow-400 bg-yellow-500/30 text-yellow-200'
						: 'border-slate-500 bg-slate-600/50 text-slate-300'
					: color.bg + ' border-transparent ' + color.text + ' opacity-70'}"
			>
				{#if cell.marked}
					<span class="text-lg {isWinning ? 'text-yellow-300' : 'text-white'}">✕</span>
				{:else}
					{categoryShortLabel(cell.category)}
				{/if}
			</div>
		{/if}
	{/each}
</div>
