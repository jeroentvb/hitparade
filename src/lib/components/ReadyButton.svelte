<script lang="ts">
	import { Button } from 'flowbite-svelte';

	let {
		readyCount,
		totalCount,
		onready,
		disabled = false
	}: {
		readyCount: number;
		totalCount: number;
		onready: () => void;
		disabled?: boolean;
	} = $props();
</script>

<div class="text-center">
	<Button color="purple" size="lg" {disabled} onclick={onready}>Ready for next round</Button>
	<p class="mt-2 text-sm text-slate-400">
		{readyCount}/{totalCount} ready
	</p>
</div>
