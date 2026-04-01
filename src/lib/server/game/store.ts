import type { GameConfig, GameSession, LobbyState, Player, Track } from './types.js';
import { generateJoinCode } from './join-codes.js';

const games: Map<string, GameSession> =
	((globalThis as Record<string, unknown>).__hitparade_games as Map<string, GameSession>) ??
	new Map<string, GameSession>();
(globalThis as Record<string, unknown>).__hitparade_games = games;

export function createGame(
	config: GameConfig,
	host: { socketId: string; nickname: string },
	tracks: Track[] = []
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
		tracks,
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

export function registerSocket(
	code: string,
	nickname: string,
	socketId: string
): Player | undefined {
	const session = games.get(code.toUpperCase());
	if (!session) return undefined;
	const player = session.players.find((p) => p.nickname.toLowerCase() === nickname.toLowerCase());
	if (!player) return undefined;
	player.socketId = socketId;
	return player;
}

export function startGame(code: string, socketId: string): GameSession {
	const session = games.get(code.toUpperCase());
	if (!session) throw new Error('Game not found');
	if (session.host.socketId !== socketId) throw new Error('Only the host can start the game');
	const connectedCount = session.players.filter((p) => p.socketId !== 'pending').length;
	if (connectedCount < 2) throw new Error('Need at least 2 connected players');
	session.status = 'playing';
	return session;
}

export function getLobbyState(code: string): LobbyState | undefined {
	const session = games.get(code.toUpperCase());
	if (!session) return undefined;
	return {
		code: session.code,
		status: session.status,
		config: {
			difficulty: session.config.difficulty,
			playlistName: session.config.playlistName,
			fuzzyThreshold: session.config.fuzzyThreshold,
			maxPlayers: session.config.maxPlayers
		},
		players: session.players.map((p) => ({
			nickname: p.nickname,
			connected: p.socketId !== 'pending'
		})),
		hostNickname: session.host.nickname
	};
}

export function _resetStore(): void {
	games.clear();
}
