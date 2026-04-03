<script lang="ts">
	let {
		winner
	}: {
		winner: {
			nickname: string;
			winningLine: number[];
			scoreboard: { nickname: string; score: number }[];
		};
	} = $props();

	// We don't have the winner's scorecard here, only the winning line.
	// The WinScreen shows the celebration + final scores.
</script>

<div class="space-y-6 text-center">
	<!-- Celebration -->
	<div>
		<div class="mb-3 text-6xl">🎉</div>
		<h1
			class="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
		>
			Bingo!
		</h1>
		<p class="mt-2 text-xl font-semibold text-white">{winner.nickname} wins!</p>
	</div>

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
</div>
