import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClient, fetchUserPlaylists } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ locals }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const client = getClient(sessionId);
		const playlists = await fetchUserPlaylists(client);
		return json({ playlists });
	} catch {
		return json({ error: 'Session expired' }, { status: 401 });
	}
};
