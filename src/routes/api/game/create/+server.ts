import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Difficulty } from '$lib/server/game/types.js';
import { createGame } from '$lib/server/game';
import { getClient, fetchPlaylistTracks, parsePlaylistId, play, pause } from '$lib/server/spotify';

export const POST: RequestHandler = async ({ locals, request }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated with Spotify' }, { status: 401 });
	}

	const body = await request.json();
	const { playlistId: rawPlaylistId, difficulty, fuzzyThreshold, nickname } = body;

	if (!rawPlaylistId || !difficulty || !nickname?.trim()) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const playlistId = parsePlaylistId(rawPlaylistId) ?? rawPlaylistId;

	if (!['A', 'B'].includes(difficulty)) {
		return json({ error: 'Invalid difficulty' }, { status: 400 });
	}

	const threshold =
		typeof fuzzyThreshold === 'number' ? Math.min(100, Math.max(0, fuzzyThreshold)) : 70;

	let client;
	try {
		client = getClient(sessionId);
	} catch {
		return json({ error: 'Spotify session expired' }, { status: 401 });
	}

	const [{ tracks }, playlist] = await Promise.all([
		fetchPlaylistTracks(client, playlistId),
		client.playlists.getPlaylist(playlistId)
	]);

	if (tracks.length === 0) {
		return json({ error: 'Playlist has no playable tracks' }, { status: 400 });
	}

	const session = createGame(
		{
			difficulty: difficulty as Difficulty,
			fuzzyThreshold: threshold,
			maxPlayers: 20,
			playlistName: playlist.name
		},
		{ socketId: 'pending', nickname: nickname.trim() },
		tracks
	);

	session.playTrack = (trackUri, deviceId) => play(sessionId, trackUri, deviceId);
	session.pauseTrack = (deviceId) => pause(sessionId, deviceId);

	const headers = new Headers();
	headers.append(
		'Set-Cookie',
		`hp_player_nickname=${encodeURIComponent(nickname.trim())}; Path=/; HttpOnly; SameSite=Lax`
	);

	return json({ code: session.code }, { headers });
};
