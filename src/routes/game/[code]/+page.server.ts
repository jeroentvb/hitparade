import type { PageServerLoad } from './$types';
import { getGame } from '$lib/server/game';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const game = getGame(params.code);
	if (!game) throw error(404, 'Game not found');

	const nickname = locals.playerNickname;
	if (!nickname) throw redirect(303, `/join?code=${params.code}`);

	const player = game.players.find((p) => p.nickname.toLowerCase() === nickname.toLowerCase());
	if (!player) throw redirect(303, `/join?code=${params.code}`);

	const isHost = game.host.nickname.toLowerCase() === nickname.toLowerCase();

	return {
		game: {
			code: game.code,
			status: game.status,
			config: {
				difficulty: game.config.difficulty,
				playlistName: game.config.playlistName,
				fuzzyThreshold: game.config.fuzzyThreshold,
				maxPlayers: game.config.maxPlayers
			},
			players: game.players.map((p) => ({
				nickname: p.nickname,
				connected: p.socketId !== 'pending' && p.socketId !== 'disconnected'
			})),
			hostNickname: game.host.nickname
		},
		player: {
			nickname: player.nickname,
			isHost
		}
	};
};
