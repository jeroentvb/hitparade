<script lang="ts">
	import { Button } from 'flowbite-svelte';
</script>

<svelte:head>
	<title>Hitparade</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center justify-center px-4 text-center">
	<div class="mb-2 text-6xl">🎵</div>
	<h1
		class="mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300 bg-clip-text text-6xl font-extrabold tracking-tight text-transparent sm:text-7xl"
	>
		Hitparade
	</h1>
	<p class="mb-10 max-w-md text-lg text-slate-400">
		Play music, guess the year, and shout BINGO before anyone else!
	</p>

	<div class="flex flex-col gap-4 sm:flex-row">
		<Button href="/host/setup" size="xl" color="purple" class="min-w-48">Start a game</Button>
		<Button href="/join" size="xl" outline color="purple" class="min-w-48">Join a game</Button>
	</div>
</main>
