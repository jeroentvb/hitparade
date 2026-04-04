<script lang="ts">
	import { categoryColor } from './categoryColors';
	import { categoryName, type CategorySlug } from '$lib/categories';

	let {
		cells,
		categories,
		eligibleCells = [],
		onplace = null,
		winningLine = null
	}: {
		cells: { category: CategorySlug; marked: boolean }[];
		categories: readonly { slug: string; name: string }[];
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
				class="relative flex h-14 w-14 items-center justify-center rounded-lg border-2 text-xs font-bold transition-all {color.border} {color.bg} ring-2 {color.glow} animate-pulse cursor-pointer opacity-90 hover:opacity-100"
				aria-label="Place cross on {categoryName(cell.category)}"
				onclick={() => onplace?.(i)}
			>
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
				{/if}
			</div>
		{/if}
	{/each}
</div>

<div class="mx-auto mt-3 flex w-fit flex-wrap justify-center gap-x-4 gap-y-1">
	{#each categories as cat (cat.slug)}
		{@const color = categoryColor(cat.slug as CategorySlug)}
		<span class="flex items-center gap-1.5 text-xs text-slate-300">
			<span class="inline-block h-3 w-3 rounded {color.bg}"></span>
			{cat.name}
		</span>
	{/each}
</div>
