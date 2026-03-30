import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getValidTokens,
	getSpotifyClient,
	fetchPlaylistTracks,
	parsePlaylistId
} from '$lib/server/spotify';

export const GET: RequestHandler = async ({ locals, params }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const tokens = await getValidTokens(sessionId);
	if (!tokens) {
		return json({ error: 'Session expired' }, { status: 401 });
	}

	const playlistId = parsePlaylistId(params.id);
	if (!playlistId) {
		return json({ error: 'Invalid playlist ID' }, { status: 400 });
	}

	const client = getSpotifyClient(tokens);
	const { tracks, skippedCount } = await fetchPlaylistTracks(client, playlistId);

	return json({
		tracks,
		skippedCount,
		totalFetched: tracks.length + skippedCount
	});
};
