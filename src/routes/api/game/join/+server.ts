import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { joinGame } from '$lib/server/game';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { code, nickname } = body;

	if (!code?.trim() || !nickname?.trim()) {
		return json({ error: 'Game code and nickname are required' }, { status: 400 });
	}

	try {
		joinGame(code.trim(), { socketId: 'pending', nickname: nickname.trim() });

		const headers = new Headers();
		headers.append(
			'Set-Cookie',
			`hp_player_nickname=${encodeURIComponent(nickname.trim())}; Path=/; HttpOnly; SameSite=Lax`
		);

		return json({ code: code.trim().toUpperCase() }, { headers });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to join game';
		return json({ error: message }, { status: 400 });
	}
};
