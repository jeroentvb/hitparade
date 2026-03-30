import type { GameConfig, GameSession, Player } from './types.js';
import { generateJoinCode } from './join-codes.js';

const games = new Map<string, GameSession>();

export function createGame(
	config: GameConfig,
	host: { socketId: string; nickname: string }
): GameSession {
	const code = generateJoinCode(games);
	const hostPlayer: Player = {
		socketId: host.socketId,
		nickname: host.nickname,
		scorecard: null,
		score: 0,
		ready: false
	};
	const session: GameSession = {
		code,
		config,
		host: hostPlayer,
		players: [hostPlayer],
		tracks: [],
		playedTrackUris: [],
		currentRound: null,
		status: 'lobby',
		createdAt: Date.now()
	};
	games.set(code, session);
	return session;
}

export function getGame(code: string): GameSession | undefined {
	return games.get(code.toUpperCase());
}

export function joinGame(code: string, player: { socketId: string; nickname: string }): Player {
	const session = games.get(code.toUpperCase());
	if (!session) {
		throw new Error('Game not found');
	}
	if (session.status !== 'lobby') {
		throw new Error('Game already started');
	}
	if (session.players.length >= session.config.maxPlayers) {
		throw new Error('Game is full');
	}
	const nickLower = player.nickname.toLowerCase();
	if (session.players.some((p) => p.nickname.toLowerCase() === nickLower)) {
		throw new Error('Nickname already taken');
	}

	const newPlayer: Player = {
		socketId: player.socketId,
		nickname: player.nickname,
		scorecard: null,
		score: 0,
		ready: false
	};
	session.players.push(newPlayer);
	return newPlayer;
}

export function removePlayer(
	code: string,
	socketId: string
): { removed: Player | undefined; isEmpty: boolean } {
	const session = games.get(code.toUpperCase());
	if (!session) {
		return { removed: undefined, isEmpty: true };
	}

	const index = session.players.findIndex((p) => p.socketId === socketId);
	if (index === -1) {
		return { removed: undefined, isEmpty: session.players.length === 0 };
	}

	const [removed] = session.players.splice(index, 1);

	if (session.players.length === 0) {
		games.delete(session.code);
		return { removed, isEmpty: true };
	}

	if (session.host.socketId === socketId) {
		session.host = session.players[0];
	}

	return { removed, isEmpty: false };
}

export function cleanupStale(now: number = Date.now()): number {
	const maxAge = 3_600_000;
	let removed = 0;
	for (const [code, session] of games) {
		if (now - session.createdAt > maxAge) {
			games.delete(code);
			removed++;
		}
	}
	return removed;
}

export function _resetStore(): void {
	games.clear();
}
