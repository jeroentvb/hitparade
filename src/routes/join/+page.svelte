<script lang="ts">
	import { page } from '$app/stores';
	import { Button, Input, Label, Spinner, Alert } from 'flowbite-svelte';

	let code = $state($page.url.searchParams.get('code') ?? '');
	let nickname = $state('');
	let joining = $state(false);
	let error = $state('');

	const canJoin = $derived(code.trim().length > 0 && nickname.trim().length > 0);

	async function joinGame() {
		if (!canJoin) return;
		joining = true;
		error = '';

		try {
			const res = await fetch('/api/game/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: code.trim(),
					nickname: nickname.trim()
				})
			});

			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Failed to join game';
				return;
			}

			window.location.href = `/game/${data.code}`;
		} catch {
			error = 'Failed to join game';
		} finally {
			joining = false;
		}
	}
</script>

<svelte:head>
	<title>Join Game — Hitparade</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center justify-center px-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h1
				class="mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300 bg-clip-text pb-1 text-4xl font-extrabold tracking-tight text-transparent"
			>
				Join a Game
			</h1>
			<p class="text-slate-400">Enter the game code and pick a nickname</p>
		</div>

		{#if error}
			<Alert color="red" dismissable onclick={() => (error = '')}>
				{error}
			</Alert>
		{/if}

		<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
			<div class="space-y-5">
				<div>
					<Label for="game-code" class="mb-2 text-slate-300">Game code</Label>
					<Input
						id="game-code"
						bind:value={code}
						placeholder="e.g. FUNK-42"
						size="sm"
						maxlength={20}
						class="uppercase"
					/>
				</div>

				<div>
					<Label for="nickname" class="mb-2 text-slate-300">Nickname</Label>
					<Input
						id="nickname"
						bind:value={nickname}
						placeholder="Enter your nickname"
						size="sm"
						maxlength={20}
					/>
				</div>
			</div>
		</section>

		<div class="flex flex-col gap-3">
			<Button
				color="purple"
				size="xl"
				class="w-full"
				disabled={!canJoin || joining}
				onclick={joinGame}
			>
				{#if joining}
					<Spinner size="4" class="me-2" />
					Joining...
				{:else}
					Join Game
				{/if}
			</Button>

			<Button href="/" size="xl" outline color="purple" class="w-full">Back</Button>
		</div>
	</div>
</main>
