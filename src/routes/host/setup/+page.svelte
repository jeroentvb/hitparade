<script lang="ts">
	import {onMount} from 'svelte';
	import {Alert, Button, Input, Label, Radio, Spinner} from 'flowbite-svelte';
	import {CheckCircleOutline, SearchOutline} from 'flowbite-svelte-icons';

	interface PlaylistSummary {
		id: string;
		name: string;
		imageUrl: string | null;
		trackCount: number;
		owner: string;
	}

	let spotifyConnected = $state(false);
	let spotifyDisplayName = $state('');
	let spotifyLoading = $state(true);
	let connectingSpotify = $state(false);

	let playlists = $state<PlaylistSummary[]>([]);
	let playlistsLoading = $state(false);
	let selectedPlaylistId = $state<string | null>(null);
	let playlistSearch = $state('');
	let playlistUrl = $state('');

	let difficulty = $state<'A' | 'B'>('A');
	let fuzzyThreshold = $state(70);
	let nickname = $state('');

	let creating = $state(false);
	let error = $state('');

	const filteredPlaylists = $derived(
		playlistSearch
			? playlists.filter((p) => p.name.toLowerCase().includes(playlistSearch.toLowerCase()))
			: playlists
	);

	const selectedPlaylist = $derived(playlists.find((p) => p.id === selectedPlaylistId) ?? null);

	const canCreate = $derived(
		spotifyConnected && (selectedPlaylistId || playlistUrl.trim()) && nickname.trim().length > 0
	);

	async function checkSpotifyStatus() {
		try {
			const res = await fetch('/api/spotify/status');
			const data = await res.json();
			spotifyConnected = data.connected;
			spotifyDisplayName = data.displayName ?? '';
			if (data.connected) {
				await loadPlaylists();
			}
		} finally {
			spotifyLoading = false;
		}
	}

	async function connectSpotify() {
		connectingSpotify = true;
		try {
			const res = await fetch('/api/spotify/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ returnTo: '/host/setup' })
			});
			const data = await res.json();
			window.location.href = data.url;
		} catch {
			error = 'Failed to start Spotify connection';
			connectingSpotify = false;
		}
	}

	async function loadPlaylists() {
		playlistsLoading = true;
		try {
			const res = await fetch('/api/spotify/playlists');
			if (!res.ok) throw new Error('Failed to load playlists');
			const data = await res.json();
			playlists = data.playlists;
		} catch {
			error = 'Failed to load playlists';
		} finally {
			playlistsLoading = false;
		}
	}

	async function createGame() {
		if (!canCreate) return;
		creating = true;
		error = '';

		try {
			const res = await fetch('/api/game/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playlistId: selectedPlaylistId ?? playlistUrl.trim(),
					difficulty,
					fuzzyThreshold,
					nickname: nickname.trim()
				})
			});

			const data = await res.json();
			if (!res.ok) {
				error = data.error ?? 'Failed to create game';
				return;
			}

			window.location.href = `/game/${data.code}`;
		} catch {
			error = 'Failed to create game';
		} finally {
			creating = false;
		}
	}

	onMount(() => {
		checkSpotifyStatus();
	});
</script>

<svelte:head>
	<title>Host Setup — Hitparade</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center px-4 py-8">
	<div class="w-full max-w-lg space-y-8">
		<div class="text-center">
			<h1
				class="mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300 bg-clip-text pb-1 text-4xl font-extrabold tracking-tight text-transparent"
			>
				Host Setup
			</h1>
			<p class="text-slate-400">Configure your game and get ready to play!</p>
		</div>

		{#if error}
			<Alert color="red" dismissable onclick={() => (error = '')}>
				{error}
			</Alert>
		{/if}

		<!-- Step 1: Spotify Connection -->
		<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
			<h2 class="mb-4 text-lg font-semibold text-white">1. Connect Spotify</h2>

			{#if spotifyLoading}
				<div class="flex items-center gap-2 text-slate-400">
					<Spinner size="5" />
					<span>Checking connection...</span>
				</div>
			{:else if spotifyConnected}
				<div class="flex items-center gap-2 text-green-400">
					<CheckCircleOutline class="h-5 w-5" />
					<span>Connected as <strong>{spotifyDisplayName}</strong></span>
				</div>
			{:else}
				<Button color="green" onclick={connectSpotify} disabled={connectingSpotify}>
					{#if connectingSpotify}
						<Spinner size="4" class="me-2" />
						Connecting...
					{:else}
						Connect Spotify
					{/if}
				</Button>
			{/if}
		</section>

		<!-- Step 2: Playlist Selection -->
		{#if spotifyConnected}
			<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
				<h2 class="mb-4 text-lg font-semibold text-white">2. Choose a Playlist</h2>

				{#if playlistsLoading}
					<div class="flex items-center gap-2 text-slate-400">
						<Spinner size="5" />
						<span>Loading playlists...</span>
					</div>
				{:else}
					<!-- Search -->
					<div class="relative mb-4">
						<Input
							bind:value={playlistSearch}
							placeholder="Search your playlists..."
							size="sm"
							class="ps-9"
						>
							{#snippet left()}
								<SearchOutline class="h-4 w-4 text-gray-500 dark:text-gray-400" />
							{/snippet}
						</Input>
					</div>

					<!-- Playlist list -->
					<div class="mb-4 max-h-64 space-y-1 overflow-y-auto">
						{#each filteredPlaylists as playlist (playlist.id)}
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors {selectedPlaylistId ===
								playlist.id
									? 'bg-purple-600/30 ring-1 ring-purple-500'
									: 'hover:bg-slate-700/50'}"
								onclick={() => {
									selectedPlaylistId = playlist.id;
									playlistUrl = '';
								}}
							>
								{#if playlist.imageUrl}
									<img src={playlist.imageUrl} alt="" class="h-10 w-10 rounded object-cover" />
								{:else}
									<div
										class="flex h-10 w-10 items-center justify-center rounded bg-slate-700 text-slate-500"
									>
										🎵
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<div class="truncate text-sm font-medium text-white">
										{playlist.name}
									</div>
									<div class="text-xs text-slate-400">
										{playlist.trackCount} tracks &middot; {playlist.owner}
									</div>
								</div>
							</button>
						{:else}
							<p class="py-2 text-sm text-slate-400">No playlists found</p>
						{/each}
					</div>

					<!-- Or paste URL -->
					<div class="border-t border-slate-700 pt-4">
						<Label for="playlist-url" class="mb-2 text-slate-300">Or paste a playlist URL</Label>
						<Input
							id="playlist-url"
							bind:value={playlistUrl}
							placeholder="https://open.spotify.com/playlist/..."
							size="sm"
							oninput={() => {
								if (playlistUrl.trim()) selectedPlaylistId = null;
							}}
						/>
					</div>

					{#if selectedPlaylist}
						<div class="mt-3 text-sm text-purple-300">
							Selected: <strong>{selectedPlaylist.name}</strong>
						</div>
					{/if}
				{/if}
			</section>
		{/if}

		<!-- Step 3: Game Configuration -->
		{#if spotifyConnected}
			<section class="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
				<h2 class="mb-4 text-lg font-semibold text-white">3. Game Settings</h2>

				<!-- Difficulty -->
				<div class="mb-6">
					<Label class="mb-3 text-slate-300">Difficulty</Label>
					<div class="flex gap-4">
						<Radio name="difficulty" bind:group={difficulty} value="A">
							<span class="text-white">Side A</span>
							<span class="ml-1 text-xs text-slate-400">(Beginners)</span>
						</Radio>
						<Radio name="difficulty" bind:group={difficulty} value="B">
							<span class="text-white">Side B</span>
							<span class="ml-1 text-xs text-slate-400">(Experts)</span>
						</Radio>
					</div>
				</div>

				<!-- Fuzzy threshold -->
				<div class="mb-6">
					<Label for="fuzzy-threshold" class="mb-2 text-slate-300">
						Fuzzy match threshold: <strong class="text-white">{fuzzyThreshold}%</strong>
					</Label>
					<input
						id="fuzzy-threshold"
						type="range"
						bind:value={fuzzyThreshold}
						min="30"
						max="100"
						step="5"
						class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-purple-500"
					/>
					<div class="mt-1 flex justify-between text-xs text-slate-500">
						<span>Lenient</span>
						<span>Strict</span>
					</div>
				</div>

				<!-- Nickname -->
				<div>
					<Label for="nickname" class="mb-2 text-slate-300">Your nickname</Label>
					<Input
						id="nickname"
						bind:value={nickname}
						placeholder="Enter your nickname"
						size="sm"
						maxlength={20}
					/>
				</div>
			</section>
		{/if}

		<div class="flex flex-col gap-3">
			{#if spotifyConnected}
				<!-- Create Game Button -->
				<Button
					color="purple"
					size="xl"
					class="w-full"
					disabled={!canCreate || creating}
					onclick={createGame}
				>
					{#if creating}
						<Spinner size="4" class="me-2" />
						Creating game...
					{:else}
						Create Game
					{/if}
				</Button>
			{/if}

			<Button href="/" size="xl" outline color="purple" class="w-full">Back</Button>
		</div>
	</div>
</main>
