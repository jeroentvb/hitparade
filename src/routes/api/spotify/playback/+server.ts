import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { play, pause, resume } from '$lib/server/spotify';

export const POST: RequestHandler = async ({ locals, request }) => {
	const sessionId = locals.spotifySessionId;
	if (!sessionId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const body = await request.json();
	const { action, trackUri, deviceId } = body as {
		action: string;
		trackUri?: string;
		deviceId?: string;
	};

	if (!deviceId) {
		return json({ error: 'deviceId is required' }, { status: 400 });
	}

	try {
		switch (action) {
			case 'play':
				if (!trackUri) {
					return json({ error: 'trackUri is required for play' }, { status: 400 });
				}
				await play(sessionId, trackUri, deviceId);
				break;
			case 'pause':
				await pause(sessionId, deviceId);
				break;
			case 'resume':
				await resume(sessionId, deviceId);
				break;
			default:
				return json({ error: 'Invalid action' }, { status: 400 });
		}

		return json({ ok: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Playback failed';
		return json({ error: message }, { status: 502 });
	}
};
