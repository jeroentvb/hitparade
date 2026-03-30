import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSession } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ locals }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ connected: false });
	}

	const session = getSession(sessionId);
	if (!session) {
		return json({ connected: false });
	}

	return json({
		connected: true,
		displayName: session.displayName
	});
};
