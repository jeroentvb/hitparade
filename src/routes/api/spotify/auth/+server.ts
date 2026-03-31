import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAuthUrl, generateState } from '$lib/server/spotify';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const body = await request.json().catch(() => ({}));
	const returnTo = typeof body.returnTo === 'string' ? body.returnTo : '/';

	const state = generateState();
	cookies.set('spotify_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600
	});
	cookies.set('spotify_return_to', returnTo, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600
	});

	const url = generateAuthUrl(state);
	return json({ url });
};
