import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getValidTokens, getSpotifyClient, fetchUserPlaylists } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ locals }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const tokens = await getValidTokens(sessionId);
	if (!tokens) {
		return json({ error: 'Session expired' }, { status: 401 });
	}

	const client = getSpotifyClient(tokens);
	const playlists = await fetchUserPlaylists(client);

	return json({ playlists });
};
