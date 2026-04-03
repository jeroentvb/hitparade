<script lang="ts">
	let { remaining, duration }: { remaining: number; duration: number } = $props();

	const seconds = $derived(Math.ceil(remaining / 1000));
	const progress = $derived(duration > 0 ? remaining / duration : 0);
	const colorClass = $derived(
		remaining > 10000 ? 'text-purple-400' : remaining > 5000 ? 'text-orange-400' : 'text-red-400'
	);
	const barClass = $derived(
		remaining > 10000 ? 'bg-purple-500' : remaining > 5000 ? 'bg-orange-500' : 'bg-red-500'
	);
</script>

<div class="space-y-2 text-center">
	<div class="font-mono text-5xl font-bold {colorClass}">
		{seconds}
	</div>
	<div class="mx-auto h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-700">
		<div
			class="h-full rounded-full transition-all duration-100 {barClass}"
			style="width: {progress * 100}%"
		></div>
	</div>
</div>
