<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button, Spinner, Alert } from 'flowbite-svelte';
	import {
		connect,
		disconnect,
		getSocket,
		isConnected,
		registerPlayer,
		startGame,
		onLobbyUpdate,
		offLobbyUpdate,
		onGameStarted,
		offGameStarted,
		type LobbyUpdate
	} from '$lib/socket.svelte';

	let { data } = $props();

	// Initial lobby state from server — updated in real-time via socket events
	// svelte-ignore state_referenced_locally
	let lobby = $state<LobbyUpdate>({ ...data.game });
	let error = $state('');
	let starting = $state(false);
	let gameStarted = $state(false);

	const isHost = $derived(lobby.hostNickname.toLowerCase() === data.player.nickname.toLowerCase());

	const connectedCount = $derived(lobby.players.filter((p) => p.connected).length);

	const canStart = $derived(isHost && connectedCount >= 2 && !starting);

	function handleLobbyUpdate(update: LobbyUpdate) {
		lobby = update;
	}

	function handleGameStarted() {
		gameStarted = true;
	}

	function handleStartGame() {
		starting = true;
		error = '';
		startGame(data.game.code, (res) => {
			if (!res.ok) {
				error = res.error ?? 'Failed to start game';
				starting = false;
			}
		});
	}

	function doRegister() {
		registerPlayer(data.game.code, data.player.nickname, (res) => {
			if (!res.ok) {
				error = res.error ?? 'Failed to register';
			}
		});
	}

	onMount(() => {
		connect();

		const socket = getSocket();
		socket.on('connect', doRegister);
		if (isConnected()) {
			doRegister();
		}

		onLobbyUpdate(handleLobbyUpdate);
		onGameStarted(handleGameStarted);
	});

	onDestroy(() => {
		const socket = getSocket();
		socket.off('connect', doRegister);
		offLobbyUpdate(handleLobbyUpdate);
		offGameStarted(handleGameStarted);
		disconnect();
	});
</script>

<svelte:head>
	<title>Lobby — {data.game.code} — Hitparade</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center px-4 py-8">
	<div class="w-full max-w-lg space-y-6">
		{#if gameStarted}
			<!-- Placeholder for playing state (future task) -->
			<div class="text-center">
				<h1
					class="mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
				>
					Game On!
				</h1>
				<p class="text-slate-400">The game has started. Playing state coming soon...</p>
			</div>
		{:else}
			<!-- Join Code -->
			<div class="text-center">
				<p class="mb-1 text-sm tracking-widest text-slate-400 uppercase">Join Code</p>
				<h1 class="font-mono text-5xl font-extrabold tracking-wider text-white">
					{lobby.code}
				</h1>
				<p class="mt-2 text-sm text-slate-500">
					Share this code with your friends to join the game
				</p>
			</div>

			{#if error}
				<Alert color="red" dismissable onclick={() => (error = '')}>
					{error}
				</Alert>
			{/if}

			<!-- Game Config Summary -->
			<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
				<div class="flex items-center justify-between text-sm">
					<div class="text-slate-400">
						Difficulty:
						<span class="font-medium text-white">
							{lobby.config.difficulty === 'A' ? 'Side A' : 'Side B'}
						</span>
					</div>
					<div class="text-slate-400">
						Playlist:
						<span class="font-medium text-white">{lobby.config.playlistName}</span>
					</div>
				</div>
			</section>

			<!-- Player List -->
			<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-lg font-semibold text-white">Players</h2>
					<span class="text-sm text-slate-400">
						{lobby.players.length}/{lobby.config.maxPlayers}
					</span>
				</div>

				<div class="space-y-2">
					{#each lobby.players as player (player.nickname)}
						<div
							class="flex items-center gap-3 rounded-lg px-3 py-2 {player.nickname ===
							data.player.nickname
								? 'bg-purple-600/20'
								: ''}"
						>
							<span
								class="h-2.5 w-2.5 rounded-full {player.connected
									? 'bg-green-400'
									: 'bg-slate-600'}"
							></span>
							<span class="flex-1 text-sm font-medium text-white">
								{player.nickname}
								{#if player.nickname === data.player.nickname}
									<span class="text-xs text-slate-400">(you)</span>
								{/if}
							</span>
							{#if player.nickname.toLowerCase() === lobby.hostNickname.toLowerCase()}
								<span
									class="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-300"
								>
									Host
								</span>
							{/if}
						</div>
					{/each}
				</div>
			</section>

			<!-- Action Area -->
			<div class="text-center">
				{#if isHost}
					<Button
						color="purple"
						size="xl"
						class="w-full"
						disabled={!canStart}
						onclick={handleStartGame}
					>
						{#if starting}
							<Spinner size="4" class="me-2" />
							Starting...
						{:else}
							Start Game
						{/if}
					</Button>
					{#if connectedCount < 2}
						<p class="mt-2 text-sm text-slate-400">Waiting for at least 2 players to connect...</p>
					{/if}
				{:else}
					<div class="flex items-center justify-center gap-2 text-slate-400">
						<Spinner size="5" />
						<span>Waiting for host to start the game...</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</main>
