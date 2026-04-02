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
		setDeviceId,
		submitAnswer,
		placeCross,
		playerReady,
		onLobbyUpdate,
		offLobbyUpdate,
		onGameStarted,
		offGameStarted,
		onRoundSpin,
		offRoundSpin,
		onTimerStarted,
		offTimerStarted,
		onAnswerSubmitted,
		offAnswerSubmitted,
		onRoundReveal,
		offRoundReveal,
		onCrossPlacement,
		offCrossPlacement,
		onPlayerReadied,
		offPlayerReadied,
		onGameWon,
		offGameWon,
		onGameOver,
		offGameOver,
		onGamePaused,
		offGamePaused,
		type LobbyUpdate,
		type ScorecardCell,
		type CategoryInfo,
		type RoundRevealData,
		type CrossPlacementData,
		type PlayerReadiedData,
		type GameWonData,
		type GameOverData
	} from '$lib/socket.svelte';

	let { data } = $props();

	// --- Lobby state ---
	// svelte-ignore state_referenced_locally
	let lobby = $state<LobbyUpdate>({ ...data.game });
	let error = $state('');
	let starting = $state(false);
	let gameStarted = $state(false);

	const isHost = $derived(lobby.hostNickname.toLowerCase() === data.player.nickname.toLowerCase());
	const connectedCount = $derived(lobby.players.filter((p) => p.connected).length);
	const canStart = $derived(isHost && connectedCount >= 2 && !starting);

	// --- Device selection (host only) ---
	let devices = $state<Array<{ id: string; name: string }>>([]);
	let selectedDeviceId = $state('');
	let loadingDevices = $state(false);

	// --- Game round state ---
	let scorecard = $state<ScorecardCell[] | null>(null);
	let roundPhase = $state<string | null>(null);
	let roundNumber = $state(0);
	let currentCategory = $state<CategoryInfo | null>(null);
	let timerStartedAt = $state(0);
	let timerDurationMs = $state(0);
	let timerRemaining = $state(0);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let answerInput = $state('');
	let answerSubmitted = $state(false);
	let submittedCount = $state(0);
	let revealData = $state<RoundRevealData | null>(null);
	let crossPlacementData = $state<CrossPlacementData | null>(null);
	let crossPlaced = $state(false);
	let readyCount = $state(0);
	let totalPlayers = $state(0);
	let gameWinner = $state<GameWonData | null>(null);
	let gameOverData = $state<GameOverData | null>(null);
	let gamePaused = $state(false);

	// --- Lobby handlers ---

	function handleLobbyUpdate(update: LobbyUpdate) {
		lobby = update;
	}

	function handleGameStarted(payload: { code: string; scorecard: ScorecardCell[] }) {
		gameStarted = true;
		scorecard = payload.scorecard;
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

	// --- Device selection ---

	async function loadDevices() {
		loadingDevices = true;
		try {
			const res = await fetch('/api/spotify/devices');
			if (res.ok) {
				const json = await res.json();
				devices = (json.devices ?? [])
					.filter((d: { id: string | null }) => d.id !== null)
					.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }));
				if (devices.length === 1) {
					selectedDeviceId = devices[0].id;
					setDeviceId(data.game.code, selectedDeviceId);
				}
			}
		} catch {
			console.error('[game] Failed to load devices');
		}
		loadingDevices = false;
	}

	function handleDeviceChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedDeviceId = target.value;
		if (selectedDeviceId) {
			setDeviceId(data.game.code, selectedDeviceId);
		}
	}

	// --- Round handlers ---

	function handleRoundSpin(payload: { roundNumber: number; category: CategoryInfo }) {
		roundPhase = 'spin';
		roundNumber = payload.roundNumber;
		currentCategory = payload.category;
		answerInput = '';
		answerSubmitted = false;
		submittedCount = 0;
		revealData = null;
		crossPlacementData = null;
		crossPlaced = false;
		readyCount = 0;
	}

	function handleTimerStarted(payload: {
		startedAt: number;
		durationMs: number;
		category: CategoryInfo;
	}) {
		roundPhase = 'playing';
		timerStartedAt = payload.startedAt;
		timerDurationMs = payload.durationMs;
		currentCategory = payload.category;

		// Start countdown
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(() => {
			const elapsed = Date.now() - timerStartedAt;
			timerRemaining = Math.max(0, timerDurationMs - elapsed);
			if (timerRemaining <= 0 && timerInterval) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
		}, 100);
	}

	function handleAnswerSubmitted(payload: { nickname: string; total: number }) {
		submittedCount = payload.total;
	}

	function handleRoundReveal(payload: RoundRevealData) {
		roundPhase = 'reveal';
		revealData = payload;
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	function handleCrossPlacement(payload: CrossPlacementData) {
		roundPhase = 'cross-placement';
		crossPlacementData = payload;

		// If not correct or no eligible cells, auto-ready
		if (!payload.correct || payload.cells.length === 0) {
			playerReady(data.game.code);
		}
	}

	function handlePlayerReadied(payload: PlayerReadiedData) {
		readyCount = payload.readyCount;
		totalPlayers = payload.totalCount;
	}

	function handleGameWon(payload: GameWonData) {
		gameWinner = payload;
		roundPhase = null;
	}

	function handleGameOver(payload: GameOverData) {
		gameOverData = payload;
		roundPhase = null;
	}

	function handleGamePaused() {
		gamePaused = true;
	}

	// --- User actions ---

	function handleSubmitAnswer() {
		if (answerSubmitted || !answerInput.trim()) return;
		answerSubmitted = true;
		submitAnswer(data.game.code, answerInput.trim());
	}

	function handlePlaceCross(cellIndex: number) {
		if (crossPlaced) return;
		crossPlaced = true;
		placeCross(data.game.code, cellIndex, (res) => {
			if (!res.ok) {
				crossPlaced = false;
				error = res.error ?? 'Failed to place cross';
			} else {
				// Update local scorecard
				if (scorecard && res.marked !== undefined) {
					scorecard[res.marked].marked = true;
				}
				// Ready up after placing
				playerReady(data.game.code);
			}
		});
	}

	function handleReady() {
		playerReady(data.game.code);
	}

	// --- Lifecycle ---

	onMount(() => {
		connect();

		const socket = getSocket();
		socket.on('connect', doRegister);
		if (isConnected()) {
			doRegister();
		}

		onLobbyUpdate(handleLobbyUpdate);
		onGameStarted(handleGameStarted);
		onRoundSpin(handleRoundSpin);
		onTimerStarted(handleTimerStarted);
		onAnswerSubmitted(handleAnswerSubmitted);
		onRoundReveal(handleRoundReveal);
		onCrossPlacement(handleCrossPlacement);
		onPlayerReadied(handlePlayerReadied);
		onGameWon(handleGameWon);
		onGameOver(handleGameOver);
		onGamePaused(handleGamePaused);

		// Load devices for host
		if (data.player.isHost) {
			loadDevices();
		}
	});

	onDestroy(() => {
		const socket = getSocket();
		socket.off('connect', doRegister);
		offLobbyUpdate(handleLobbyUpdate);
		offGameStarted(handleGameStarted);
		offRoundSpin(handleRoundSpin);
		offTimerStarted(handleTimerStarted);
		offAnswerSubmitted(handleAnswerSubmitted);
		offRoundReveal(handleRoundReveal);
		offCrossPlacement(handleCrossPlacement);
		offPlayerReadied(handlePlayerReadied);
		offGameWon(handleGameWon);
		offGameOver(handleGameOver);
		offGamePaused(handleGamePaused);
		disconnect();

		if (timerInterval) {
			clearInterval(timerInterval);
		}
	});
</script>

<svelte:head>
	<title>{gameStarted ? 'Playing' : 'Lobby'} — {data.game.code} — Hitparade</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center px-4 py-8">
	<div class="w-full max-w-lg space-y-6">
		{#if gameWinner}
			<!-- Win screen -->
			<div class="text-center">
				<h1
					class="mb-2 bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
				>
					Bingo!
				</h1>
				<p class="text-xl text-white">{gameWinner.nickname} wins!</p>
				<div class="mt-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
					<h3 class="mb-2 text-sm font-medium text-slate-400">Final Scores</h3>
					{#each gameWinner.scoreboard as entry (entry.nickname)}
						<div class="flex justify-between py-1 text-sm text-white">
							<span>{entry.nickname}</span>
							<span class="font-mono">{entry.score}</span>
						</div>
					{/each}
				</div>
			</div>
		{:else if gameOverData}
			<!-- Game over screen -->
			<div class="text-center">
				<h1 class="mb-2 text-3xl font-bold text-white">Game Over</h1>
				<p class="text-slate-400">
					{gameOverData.reason === 'no-tracks'
						? 'No more tracks left in the playlist!'
						: 'The game has ended.'}
				</p>
				<div class="mt-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
					<h3 class="mb-2 text-sm font-medium text-slate-400">Final Scores</h3>
					{#each gameOverData.scoreboard as entry (entry.nickname)}
						<div class="flex justify-between py-1 text-sm text-white">
							<span>{entry.nickname}</span>
							<span class="font-mono">{entry.score}</span>
						</div>
					{/each}
				</div>
			</div>
		{:else if gamePaused}
			<!-- Game paused -->
			<div class="text-center">
				<h1 class="mb-2 text-3xl font-bold text-yellow-300">Game Paused</h1>
				<p class="text-slate-400">Waiting for the host to reconnect...</p>
				<Spinner size="8" class="mt-4" />
			</div>
		{:else if gameStarted}
			<!-- Game playing state -->
			<div class="space-y-4">
				<!-- Round info -->
				<div class="text-center">
					<p class="text-sm text-slate-400">Round {roundNumber}</p>
					{#if currentCategory}
						<h2 class="text-2xl font-bold text-white">{currentCategory.name}</h2>
					{/if}
				</div>

				{#if error}
					<Alert color="red" dismissable onclick={() => (error = '')}>
						{error}
					</Alert>
				{/if}

				{#if roundPhase === 'spin'}
					<!-- Spin phase -->
					<div class="text-center">
						<div class="mb-4 text-6xl">🎵</div>
						<p class="text-lg text-slate-300">Spinning...</p>
					</div>
				{:else if roundPhase === 'playing'}
					<!-- Playing phase: timer + answer input -->
					<div class="space-y-4">
						<!-- Timer -->
						<div class="text-center">
							<div class="font-mono text-4xl font-bold text-white">
								{Math.ceil(timerRemaining / 1000)}s
							</div>
							<div class="mt-2 h-2 w-full rounded-full bg-slate-700">
								<div
									class="h-2 rounded-full transition-all duration-100 {timerRemaining > 10000
										? 'bg-purple-500'
										: timerRemaining > 5000
											? 'bg-orange-500'
											: 'bg-red-500'}"
									style="width: {(timerRemaining / timerDurationMs) * 100}%"
								></div>
							</div>
						</div>

						<!-- Answer input -->
						{#if !answerSubmitted}
							<form onsubmit={handleSubmitAnswer} class="flex gap-2">
								<input
									type="text"
									bind:value={answerInput}
									placeholder="Your answer..."
									class="flex-1 rounded-lg border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-purple-500"
								/>
								<Button color="purple" type="submit" disabled={!answerInput.trim()}>Submit</Button>
							</form>
						{:else}
							<p class="text-center text-sm text-green-400">Answer submitted!</p>
						{/if}

						<p class="text-center text-xs text-slate-500">
							{submittedCount} answer{submittedCount !== 1 ? 's' : ''} submitted
						</p>
					</div>
				{:else if roundPhase === 'reveal'}
					<!-- Reveal phase -->
					{#if revealData}
						<div class="space-y-4">
							<!-- Track info -->
							<div class="rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-center">
								<p class="text-lg font-bold text-white">{revealData.track.name}</p>
								<p class="text-sm text-slate-400">
									{revealData.track.artists.join(', ')}
								</p>
								<p class="text-sm text-slate-500">
									{revealData.track.albumName} &middot; {revealData.track.releaseYear}
								</p>
							</div>

							<!-- Player results -->
							<div class="space-y-2">
								{#each revealData.results as result (result.nickname)}
									<div
										class="flex items-center justify-between rounded-lg px-3 py-2 {result.correct
											? 'border border-green-700 bg-green-900/30'
											: 'border border-red-700 bg-red-900/30'}"
									>
										<span class="text-sm text-white">{result.nickname}</span>
										<span class="text-sm {result.correct ? 'text-green-400' : 'text-red-400'}">
											{result.answer || '(no answer)'}
											{result.correct ? '✓' : '✗'}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else if roundPhase === 'cross-placement'}
					<!-- Cross placement phase -->
					{#if crossPlacementData?.correct && crossPlacementData.cells.length > 0 && !crossPlaced}
						<div class="text-center">
							<p class="mb-4 text-lg text-green-400">Correct! Place your cross:</p>
							<!-- Scorecard grid for cross placement -->
							{#if scorecard}
								<div class="mx-auto grid w-fit grid-cols-5 gap-1">
									{#each scorecard as cell, i (i)}
										<button
											class="h-12 w-12 rounded text-xs font-medium transition-colors
												{cell.marked
												? 'cursor-not-allowed bg-purple-700 text-purple-200'
												: crossPlacementData.cells.includes(i)
													? 'cursor-pointer bg-green-600 text-white hover:bg-green-500'
													: 'cursor-not-allowed bg-slate-700 text-slate-400'}"
											disabled={cell.marked || !crossPlacementData.cells.includes(i)}
											onclick={() => handlePlaceCross(i)}
										>
											{cell.marked ? '✕' : ''}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{:else if crossPlacementData?.correct && crossPlaced}
						<div class="text-center">
							<p class="text-green-400">Cross placed! Waiting for others...</p>
							<p class="mt-2 text-sm text-slate-400">
								{readyCount}/{totalPlayers} ready
							</p>
						</div>
					{:else}
						<!-- Wrong answer — ready up -->
						<div class="text-center">
							<p class="mb-4 text-red-400">Wrong answer this round</p>
							<Button color="purple" onclick={handleReady}>Ready for next round</Button>
							<p class="mt-2 text-sm text-slate-400">
								{readyCount}/{totalPlayers} ready
							</p>
						</div>
					{/if}
				{:else}
					<!-- Waiting state between phases -->
					<div class="flex items-center justify-center gap-2 text-slate-400">
						<Spinner size="5" />
						<span>Starting next round...</span>
					</div>
				{/if}

				<!-- Scorecard (always visible during game) -->
				{#if scorecard && roundPhase !== 'cross-placement'}
					<div class="mt-6">
						<h3 class="mb-2 text-center text-sm font-medium text-slate-400">Your Scorecard</h3>
						<div class="mx-auto grid w-fit grid-cols-5 gap-1">
							{#each scorecard as cell, i (i)}
								<div
									class="flex h-12 w-12 items-center justify-center rounded text-xs font-medium
										{cell.marked ? 'bg-purple-700 text-purple-200' : 'bg-slate-700 text-slate-400'}"
								>
									{cell.marked ? '✕' : ''}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Lobby screen -->
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

			<!-- Device Selection (host only) -->
			{#if isHost}
				<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
					<h3 class="mb-2 text-sm font-medium text-white">Spotify Device</h3>
					{#if loadingDevices}
						<div class="flex items-center gap-2 text-slate-400">
							<Spinner size="4" />
							<span class="text-sm">Loading devices...</span>
						</div>
					{:else if devices.length === 0}
						<p class="text-sm text-slate-400">No devices found.</p>
						<Button color="alternative" size="xs" class="mt-2" onclick={loadDevices}>
							Refresh
						</Button>
					{:else}
						<select
							class="w-full rounded-lg border-slate-600 bg-slate-800 text-sm text-white focus:border-purple-500 focus:ring-purple-500"
							value={selectedDeviceId}
							onchange={handleDeviceChange}
						>
							<option value="">Select a device...</option>
							{#each devices as device (device.id)}
								<option value={device.id}>{device.name}</option>
							{/each}
						</select>
						<Button color="alternative" size="xs" class="mt-2" onclick={loadDevices}>
							Refresh
						</Button>
					{/if}
				</section>
			{/if}

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
