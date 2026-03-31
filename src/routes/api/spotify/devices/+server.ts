import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDevices } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ locals }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const devices = await getDevices(sessionId);
		return json({ devices });
	} catch {
		return json({ error: 'Session expired' }, { status: 401 });
	}
};
