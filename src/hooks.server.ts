import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.spotifySessionId = event.cookies.get('spotify_session');
	return resolve(event);
};
