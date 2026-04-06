<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import { categoryColor } from './categoryColors';
	import type { ScorecardSummary } from '$lib/socket.svelte';
	import Scorecard from './Scorecard.svelte';

	let {
		scorecards,
		categories
	}: {
		scorecards: ScorecardSummary[];
		categories: readonly { slug: string; name: string }[];
	} = $props();

	let expanded = $state(false);
	let selectedCard = $state<ScorecardSummary | null>(null);
	let modalOpen = $state(false);

	function openCard(card: ScorecardSummary) {
		selectedCard = card;
		modalOpen = true;
	}
</script>

{#if scorecards.length > 0}
	<div class="mt-4">
		<button
			class="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
			onclick={() => (expanded = !expanded)}
		>
			<span>{expanded ? 'Hide' : 'View'} other cards ({scorecards.length})</span>
			<span class="text-xs">{expanded ? '▲' : '▼'}</span>
		</button>

		{#if expanded}
			<div class="mt-2 flex justify-center gap-4 overflow-x-auto pb-2">
				{#each scorecards as card (card.nickname)}
					<button
						class="flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2 transition-colors hover:border-slate-500"
						onclick={() => openCard(card)}
					>
						<span class="max-w-[70px] truncate text-xs font-medium text-slate-300">
							{card.nickname}
						</span>
						<div class="grid grid-cols-5 gap-0.5">
							{#each card.cells as cell, i (i)}
								{@const color = categoryColor(cell.category)}
								{@const isWinning = card.winningLine?.includes(i) ?? false}
								<div
									class="h-3 w-3 rounded-sm {cell.marked
										? isWinning
											? 'bg-yellow-400'
											: 'bg-slate-400'
										: color.bg + ' opacity-70'}"
								></div>
							{/each}
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<Modal bind:open={modalOpen} title={selectedCard?.nickname ?? ''} size="sm">
	{#if selectedCard}
		<Scorecard cells={selectedCard.cells} {categories} winningLine={selectedCard.winningLine} />
	{/if}
</Modal>
