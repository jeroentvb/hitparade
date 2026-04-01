import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.spotifySessionId = event.cookies.get('spotify_session');
	event.locals.playerNickname = event.cookies.get('hp_player_nickname');
	return resolve(event);
};
