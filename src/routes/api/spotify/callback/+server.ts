import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCode, createClient, storeSession, generateSessionId } from '$lib/server/spotify';
import type { SpotifySession } from '$lib/server/spotify';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const storedState = cookies.get('spotify_oauth_state');
	const returnTo = cookies.get('spotify_return_to') || '/';

	cookies.delete('spotify_oauth_state', { path: '/' });
	cookies.delete('spotify_return_to', { path: '/' });

	if (error) {
		redirect(303, `${returnTo}${returnTo.includes('?') ? '&' : '?'}spotify_error=access_denied`);
	}

	if (!code || !state || state !== storedState) {
		redirect(303, `${returnTo}${returnTo.includes('?') ? '&' : '?'}spotify_error=invalid_state`);
	}

	let token;
	try {
		token = await exchangeCode(code);
	} catch {
		redirect(303, '/?spotify_error=token_exchange_failed');
	}

	const client = createClient(token);
	const profile = await client.currentUser.profile();

	const sessionId = generateSessionId();
	const session: SpotifySession = {
		client,
		userId: profile.id,
		displayName: profile.display_name ?? profile.id
	};
	storeSession(sessionId, session);

	cookies.set('spotify_session', sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 8
	});

	redirect(303, `${returnTo}${returnTo.includes('?') ? '&' : '?'}spotify=connected`);
};
