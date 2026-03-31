<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Game {page.params.code} — Hitparade</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center justify-center px-4 text-center">
	<h1 class="text-4xl font-bold text-white">Game {page.params.code}</h1>
	<p class="mt-2 text-slate-400">Coming soon...</p>
</main>
