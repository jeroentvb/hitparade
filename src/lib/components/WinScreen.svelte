<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import type { ScorecardSummary } from '$lib/socket.svelte';
	import Scorecard from './Scorecard.svelte';
	import OtherScorecards from './OtherScorecards.svelte';

	let {
		winner,
		scorecards = [],
		categories = []
	}: {
		winner: {
			nickname: string;
			winningLine: number[];
			scoreboard: { nickname: string; score: number }[];
		};
		scorecards?: ScorecardSummary[];
		categories?: readonly { slug: string; name: string }[];
	} = $props();

	const winnerCard = $derived(scorecards.find((s) => s.nickname === winner.nickname) ?? null);

	const otherCards = $derived(scorecards.filter((s) => s.nickname !== winner.nickname));
</script>

<div class="space-y-6 text-center">
	<!-- Celebration -->
	<div>
		<div class="mb-3 text-6xl">🎉</div>
		<h1
			class="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text pb-1 text-4xl font-extrabold tracking-tight text-transparent"
		>
			Bingo!
		</h1>
		<p class="mt-2 text-xl font-semibold text-white">{winner.nickname} wins!</p>
	</div>

	<!-- Winner's scorecard -->
	{#if winnerCard}
		<div>
			<h3 class="mb-2 text-sm font-medium tracking-wide text-slate-400 uppercase">
				{winner.nickname}'s winning card
			</h3>
			<Scorecard cells={winnerCard.cells} {categories} winningLine={winnerCard.winningLine} />
		</div>
	{/if}

	<!-- Other players' scorecards -->
	{#if otherCards.length > 0}
		<OtherScorecards scorecards={otherCards} {categories} />
	{/if}

	<!-- Final Scores -->
	<div class="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
		<h3 class="mb-3 text-sm font-medium tracking-wide text-slate-400 uppercase">Final Scores</h3>
		<div class="space-y-1">
			{#each winner.scoreboard.toSorted((a, b) => b.score - a.score) as entry, i (entry.nickname)}
				<div
					class="flex items-center justify-between rounded-lg px-3 py-2 {i === 0
						? 'bg-yellow-500/10'
						: ''}"
				>
					<div class="flex items-center gap-2">
						{#if i === 0}
							<span class="text-lg">👑</span>
						{:else}
							<span class="w-7 text-center text-sm text-slate-500">{i + 1}</span>
						{/if}
						<span class="text-sm font-medium text-white">{entry.nickname}</span>
					</div>
					<span class="font-mono text-sm font-bold text-white">{entry.score}</span>
				</div>
			{/each}
		</div>
	</div>

	<Button href="/" size="xl" outline color="purple" class="w-full">Back to menu</Button>
</div>
