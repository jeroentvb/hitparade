import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClient, fetchPlaylistTracks, parsePlaylistId } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ locals, params }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const playlistId = parsePlaylistId(params.id);
	if (!playlistId) {
		return json({ error: 'Invalid playlist ID' }, { status: 400 });
	}

	try {
		const client = getClient(sessionId);
		const { tracks, skippedCount } = await fetchPlaylistTracks(client, playlistId);
		return json({
			tracks,
			skippedCount,
			totalFetched: tracks.length + skippedCount
		});
	} catch {
		return json({ error: 'Session expired' }, { status: 401 });
	}
};
