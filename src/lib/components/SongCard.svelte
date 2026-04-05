<script lang="ts">
	let {
		track,
		revealed = false
	}: {
		track: { name: string; artists: string[]; albumName: string; releaseYear: number } | null;
		revealed?: boolean;
	} = $props();
</script>

<div class="mx-auto w-full max-w-sm" style="perspective: 600px">
	<div
		class="relative h-40 transition-transform duration-700"
		style="transform-style: preserve-3d; {revealed ? 'transform: rotateY(180deg)' : ''}"
	>
		<!-- Front -->
		<!--		<div-->
		<!--			class="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900"-->
		<!--			style="backface-visibility: hidden"-->
		<!--		>-->
		<!--			<span class="mb-2 text-4xl">🎵</span>-->
		<!--			<p class="text-lg font-medium text-slate-300">Now playing...</p>-->
		<!--		</div>-->

		<!-- Back -->
		<div
			class="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-purple-600/50 bg-gradient-to-br from-purple-900/60 to-slate-900"
			style="backface-visibility: hidden; transform: rotateY(180deg)"
		>
			{#if track}
				<p class="px-4 text-center text-lg font-bold text-white">{track.name}</p>
				<p class="mt-1 text-sm text-purple-300">{track.artists.join(', ')}</p>
				<p class="mt-1 text-xs text-slate-400">
					{track.albumName} &middot; {track.releaseYear}
				</p>
			{/if}
		</div>
	</div>
</div>
