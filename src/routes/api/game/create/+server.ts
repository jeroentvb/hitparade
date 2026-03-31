import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Difficulty } from '$lib/server/game/types.js';
import { createGame } from '$lib/server/game';
import {
	getValidTokens,
	getSpotifyClient,
	fetchPlaylistTracks,
	parsePlaylistId
} from '$lib/server/spotify';

export const POST: RequestHandler = async ({ locals, request }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated with Spotify' }, { status: 401 });
	}

	const tokens = await getValidTokens(sessionId);
	if (!tokens) {
		return json({ error: 'Spotify session expired' }, { status: 401 });
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

	const client = getSpotifyClient(tokens);
	const { tracks } = await fetchPlaylistTracks(client, playlistId);

	if (tracks.length === 0) {
		return json({ error: 'Playlist has no playable tracks' }, { status: 400 });
	}

	const session = createGame(
		{
			difficulty: difficulty as Difficulty,
			fuzzyThreshold: threshold,
			maxPlayers: 20
		},
		{ socketId: 'pending', nickname: nickname.trim() },
		tracks
	);

	return json({ code: session.code });
};
