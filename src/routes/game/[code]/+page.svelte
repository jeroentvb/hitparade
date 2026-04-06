<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Alert, Button, Spinner } from 'flowbite-svelte';
	import DiscoSpinner from '$lib/components/DiscoSpinner.svelte';
	import SongCard from '$lib/components/SongCard.svelte';
	import Timer from '$lib/components/Timer.svelte';
	import AnswerInput from '$lib/components/AnswerInput.svelte';
	import Scorecard from '$lib/components/Scorecard.svelte';
	import ResultBanner from '$lib/components/ResultBanner.svelte';
	import ReadyButton from '$lib/components/ReadyButton.svelte';
	import WinScreen from '$lib/components/WinScreen.svelte';
	import { categoriesForDifficulty } from '$lib/categories.js';
	import { categoryColor } from '$lib/components/categoryColors.js';
	import {
		type CategoryInfo,
		connect,
		type CrossPlacementData,
		disconnect,
		type GameOverData,
		type GameWonData,
		getSocket,
		isConnected,
		type LobbyUpdate,
		offAnswerSubmitted,
		offCrossPlacement,
		offGameOver,
		offGamePaused,
		offGameStarted,
		offGameWon,
		offLobbyUpdate,
		offPlayerReadied,
		offRoundReveal,
		offRoundSpin,
		offScoresUpdate,
		offTimerStarted,
		onAnswerSubmitted,
		onCrossPlacement,
		onGameOver,
		onGamePaused,
		onGameStarted,
		onGameWon,
		onLobbyUpdate,
		onPlayerReadied,
		onRoundReveal,
		onRoundSpin,
		onScoresUpdate,
		onTimerStarted,
		placeCross,
		type PlayerReadiedData,
		playerReady,
		registerPlayer,
		type RoundRevealData,
		type ScoreboardEntry,
		type ScorecardCell,
		setDeviceId,
		startGame,
		submitAnswer
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

	// --- Device selection (host only) ---
	let devices = $state<Array<{ id: string; name: string }>>([]);
	let selectedDeviceId = $state('');
	let loadingDevices = $state(false);

	const canStart = $derived(isHost && connectedCount >= 2 && selectedDeviceId !== '' && !starting);

	// --- Game round state ---
	let scorecard = $state<ScorecardCell[] | null>(null);
	let roundPhase = $state<string | null>(null);
	let roundNumber = $state(0);
	let currentCategory = $state<CategoryInfo | null>(null);
	let timerStartedAt = $state(0);
	let timerDurationMs = $state(0);
	let timerRemaining = $state(0);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let answerSubmitted = $state(false);
	let submittedCount = $state(0);
	let revealData = $state<RoundRevealData | null>(null);
	let crossPlacementData = $state<CrossPlacementData | null>(null);
	let crossPlaced = $state(false);
	let localReady = $state(false);
	let readyCount = $state(0);
	let totalPlayers = $state(0);
	let gameWinner = $state<GameWonData | null>(null);
	let gameOverData = $state<GameOverData | null>(null);
	let gamePaused = $state(false);
	let scores = $state<ScoreboardEntry[]>([]);
	let spinAnimating = $state(false);
	let currentInputValue = $state('');

	// Derived: the current player's result from reveal data
	const myResult = $derived(
		revealData?.results.find((r) => r.nickname === data.player.nickname) ?? null
	);

	// Categories for the spinner (from game config difficulty)
	const difficultyCategories = $derived(categoriesForDifficulty(lobby.config.difficulty));

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
			} else if (data.player.isHost) {
				loadDevices();
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

	let spinHoldTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleRoundSpin(payload: { roundNumber: number; category: CategoryInfo }) {
		roundPhase = 'spin';
		roundNumber = payload.roundNumber;
		currentCategory = payload.category;
		answerSubmitted = false;
		submittedCount = 0;
		revealData = null;
		crossPlacementData = null;
		crossPlaced = false;
		localReady = false;
		readyCount = 0;
		currentInputValue = '';

		// Trigger spin animation (3s spin + 5s hold)
		spinAnimating = true;
		if (spinHoldTimeout) clearTimeout(spinHoldTimeout);
		setTimeout(() => {
			spinAnimating = false;
		}, 3000);
		spinHoldTimeout = setTimeout(() => {
			spinHoldTimeout = null;
			if (roundPhase === 'spin') roundPhase = 'playing';
		}, 8000);
	}

	function handleTimerStarted(payload: {
		startedAt: number;
		durationMs: number;
		category: CategoryInfo;
	}) {
		if (!spinHoldTimeout) roundPhase = 'playing';
		timerStartedAt = Date.now();
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
				if (!answerSubmitted) {
					handleSubmitAnswer(currentInputValue.trim());
				}
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

	function handleScoresUpdate(data: ScoreboardEntry[]) {
		scores = [...data].sort((a, b) => b.score - a.score);
	}

	// --- User actions ---

	function handleSubmitAnswer(answer: string) {
		if (answerSubmitted) return;
		answerSubmitted = true;
		submitAnswer(data.game.code, answer);
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
				localReady = true;
			}
		});
	}

	function handleReady() {
		localReady = true;
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
		onScoresUpdate(handleScoresUpdate);

		// Devices are loaded after registration succeeds (in doRegister)
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
		offScoresUpdate(handleScoresUpdate);
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
			<WinScreen winner={gameWinner} />
		{:else if gameOverData}
			<!-- Game over screen -->
			<div class="space-y-6 text-center">
				<div>
					<h1 class="mb-2 text-3xl font-bold text-white">Game Over</h1>
					<p class="text-slate-400">
						{gameOverData.reason === 'no-tracks'
							? 'No more tracks left in the playlist!'
							: 'The game has ended.'}
					</p>
				</div>
				<div class="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
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
			<div class="text-center">
				<h1 class="mb-2 text-3xl font-bold text-yellow-300">Game Paused</h1>
				<p class="text-slate-400">Waiting for the host to reconnect...</p>
				<Spinner size="8" class="mt-4" />
			</div>
		{:else if gameStarted}
			<!-- Game playing state -->
			<div class="space-y-5">
				<!-- Round info header -->
				<div class="text-center">
					<p class="text-sm text-slate-400">Round {roundNumber}</p>
					{#if currentCategory && roundPhase !== 'spin'}
						<h2 class="flex items-center justify-center gap-2 text-2xl font-bold text-white">
							<span class="inline-block h-3 w-3 rounded {categoryColor(currentCategory.slug).bg}"></span>
							{currentCategory.name}
						</h2>
					{/if}
				</div>

				<!-- Score pills -->
				{#if scores.length > 0}
					<div class="flex flex-wrap justify-center gap-2">
						{#each scores as entry (entry.nickname)}
							<span
								class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium {entry.nickname ===
								data.player.nickname
									? 'bg-purple-600/30 text-purple-300 ring-1 ring-purple-500/50'
									: 'bg-slate-700/50 text-slate-300'}"
							>
								<span class="max-w-[6rem] truncate">{entry.nickname}</span>
								<span class="font-mono font-bold">{entry.score}</span>
							</span>
						{/each}
					</div>
				{/if}

				{#if error}
					<Alert color="red" dismissable onclick={() => (error = '')}>
						{error}
					</Alert>
				{/if}

				{#if roundPhase === 'spin'}
					<!-- Spin phase -->
					<DiscoSpinner
						categories={difficultyCategories}
						selectedCategory={currentCategory}
						spinning={spinAnimating}
					/>
				{:else if roundPhase === 'playing'}
					<!-- Playing phase: timer + answer input -->
					<div class="space-y-5">
						<Timer remaining={timerRemaining} duration={timerDurationMs} />

						{#if !answerSubmitted && currentCategory}
							<AnswerInput
								category={currentCategory}
								onsubmit={handleSubmitAnswer}
								bind:value={currentInputValue}
							/>
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
							<SongCard track={revealData.track} revealed={true} />

							<!-- My result banner -->
							{#if myResult}
								<ResultBanner
									correct={myResult.correct}
									answer={myResult.answer}
									correctAnswer={myResult.correctAnswer}
								/>
							{/if}

							<!-- All player results -->
							<div class="space-y-1.5">
								{#each revealData.results as result (result.nickname)}
									<div
										class="flex items-center justify-between rounded-lg px-3 py-2 {result.correct
											? 'border border-green-700/50 bg-green-900/20'
											: 'border border-red-700/50 bg-red-900/20'}"
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
					{#if revealData}
						<SongCard track={revealData.track} revealed={true} />
					{/if}

					{#if myResult}
						<ResultBanner
							correct={myResult.correct}
							answer={myResult.answer}
							correctAnswer={myResult.correctAnswer}
						/>
					{/if}

					{#if crossPlacementData?.correct && crossPlacementData.cells.length > 0 && !crossPlaced}
						<div class="space-y-4 text-center">
							<p class="text-lg font-medium text-green-400">Place your cross:</p>
							{#if scorecard}
								<Scorecard
									cells={scorecard}
									categories={difficultyCategories}
									eligibleCells={crossPlacementData.cells}
									onplace={handlePlaceCross}
								/>
							{/if}
						</div>
					{:else}
						<div class="space-y-4 text-center">
							{#if localReady}
								<p class="text-lg text-slate-400">Waiting for next round..</p>
								<p class="text-sm text-slate-400">
									{readyCount}/{totalPlayers} ready
								</p>
							{:else}
								<ReadyButton {readyCount} totalCount={totalPlayers} onready={handleReady} />
							{/if}
						</div>
					{/if}
				{:else}
					<!-- Waiting state between phases -->
					<div class="flex items-center justify-center gap-2 text-slate-400">
						<Spinner size="5" />
						<span>Starting next round...</span>
					</div>
				{/if}

				<!-- Scorecard (always visible during game, except during cross-placement where it's inline) -->
				{#if scorecard && !(roundPhase === 'cross-placement' && crossPlacementData?.correct && crossPlacementData.cells.length > 0 && !crossPlaced)}
					<div class="mt-4">
						<h3 class="mb-2 text-center text-sm font-medium text-slate-400">Your Scorecard</h3>
						<Scorecard cells={scorecard} categories={difficultyCategories} />
					</div>
				{/if}
			</div>
		{:else}
			<!-- Lobby screen -->
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
					{:else if selectedDeviceId === ''}
						<p class="mt-2 text-sm text-slate-400">
							Select a Spotify device above to start the game.
						</p>
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
