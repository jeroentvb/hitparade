import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAuthUrl, generateState } from '$lib/server/spotify';

export const POST: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	cookies.set('spotify_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600
	});

	const url = generateAuthUrl(state);
	return json({ url });
};
