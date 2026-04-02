import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = $state(null);
let connected: boolean = $state(false);

export function getSocket(): Socket {
	if (!socket) {
		socket = io({ autoConnect: false });

		socket.on('connect', () => {
			connected = true;
			console.log('[socket] connected:', socket!.id);
		});

		socket.on('disconnect', () => {
			connected = false;
			console.log('[socket] disconnected');
		});

		socket.on('connect_error', (err) => {
			console.error('[socket] connection error:', err.message);
		});
	}
	return socket;
}

export function isConnected(): boolean {
	return connected;
}

export function connect(): void {
	getSocket().connect();
}

export function disconnect(): void {
	socket?.disconnect();
}

export function joinRoom(roomCode: string, callback?: (response: { ok: boolean }) => void): void {
	getSocket().emit('join-room', roomCode, callback);
}

export function leaveRoom(roomCode: string): void {
	getSocket().emit('leave-room', roomCode);
}

export function sendToRoom(roomCode: string, event: string, data: unknown): void {
	getSocket().emit('room-message', { roomCode, event, data });
}

// --- Lobby events ---

export function registerPlayer(
	code: string,
	nickname: string,
	callback?: (response: { ok: boolean; error?: string }) => void
): void {
	getSocket().emit('register-player', { code, nickname }, callback);
}

export function startGame(
	code: string,
	callback?: (response: { ok: boolean; error?: string }) => void
): void {
	getSocket().emit('start-game', { code }, callback);
}

export function setDeviceId(
	code: string,
	deviceId: string,
	callback?: (response: { ok: boolean; error?: string }) => void
): void {
	getSocket().emit('set-device-id', { code, deviceId }, callback);
}

export function onLobbyUpdate(handler: (data: LobbyUpdate) => void): void {
	getSocket().on('lobby-update', handler);
}

export function offLobbyUpdate(handler: (data: LobbyUpdate) => void): void {
	getSocket().off('lobby-update', handler);
}

export function onGameStarted(
	handler: (data: { code: string; scorecard: ScorecardCell[] }) => void
): void {
	getSocket().on('game-started', handler);
}

export function offGameStarted(
	handler: (data: { code: string; scorecard: ScorecardCell[] }) => void
): void {
	getSocket().off('game-started', handler);
}

// --- Game round events ---

export function submitAnswer(
	code: string,
	answer: string,
	callback?: (response: { ok: boolean; error?: string }) => void
): void {
	getSocket().emit('submit-answer', { code, answer }, callback);
}

export function placeCross(
	code: string,
	cellIndex: number,
	callback?: (response: { ok: boolean; error?: string; marked?: number }) => void
): void {
	getSocket().emit('place-cross', { code, cellIndex }, callback);
}

export function playerReady(
	code: string,
	callback?: (response: { ok: boolean; error?: string }) => void
): void {
	getSocket().emit('player-ready', { code }, callback);
}

export function onRoundSpin(handler: (data: RoundSpinData) => void): void {
	getSocket().on('round-spin', handler);
}

export function offRoundSpin(handler: (data: RoundSpinData) => void): void {
	getSocket().off('round-spin', handler);
}

export function onTimerStarted(handler: (data: TimerStartedData) => void): void {
	getSocket().on('timer-started', handler);
}

export function offTimerStarted(handler: (data: TimerStartedData) => void): void {
	getSocket().off('timer-started', handler);
}

export function onAnswerSubmitted(handler: (data: AnswerSubmittedData) => void): void {
	getSocket().on('answer-submitted', handler);
}

export function offAnswerSubmitted(handler: (data: AnswerSubmittedData) => void): void {
	getSocket().off('answer-submitted', handler);
}

export function onRoundReveal(handler: (data: RoundRevealData) => void): void {
	getSocket().on('round-reveal', handler);
}

export function offRoundReveal(handler: (data: RoundRevealData) => void): void {
	getSocket().off('round-reveal', handler);
}

export function onCrossPlacement(handler: (data: CrossPlacementData) => void): void {
	getSocket().on('cross-placement', handler);
}

export function offCrossPlacement(handler: (data: CrossPlacementData) => void): void {
	getSocket().off('cross-placement', handler);
}

export function onPlayerReadied(handler: (data: PlayerReadiedData) => void): void {
	getSocket().on('player-readied', handler);
}

export function offPlayerReadied(handler: (data: PlayerReadiedData) => void): void {
	getSocket().off('player-readied', handler);
}

export function onGameWon(handler: (data: GameWonData) => void): void {
	getSocket().on('game-won', handler);
}

export function offGameWon(handler: (data: GameWonData) => void): void {
	getSocket().off('game-won', handler);
}

export function onGameOver(handler: (data: GameOverData) => void): void {
	getSocket().on('game-over', handler);
}

export function offGameOver(handler: (data: GameOverData) => void): void {
	getSocket().off('game-over', handler);
}

export function onGamePaused(handler: (data: GamePausedData) => void): void {
	getSocket().on('game-paused', handler);
}

export function offGamePaused(handler: (data: GamePausedData) => void): void {
	getSocket().off('game-paused', handler);
}

// --- Types ---

interface LobbyPlayer {
	nickname: string;
	connected: boolean;
}

export interface LobbyUpdate {
	code: string;
	status: string;
	config: {
		difficulty: string;
		playlistName: string;
		fuzzyThreshold: number;
		maxPlayers: number;
	};
	players: LobbyPlayer[];
	hostNickname: string;
}

export interface ScorecardCell {
	category: string;
	marked: boolean;
}

export interface CategoryInfo {
	slug: string;
	name: string;
}

export interface RoundSpinData {
	roundNumber: number;
	category: CategoryInfo;
}

export interface TimerStartedData {
	startedAt: number;
	durationMs: number;
	category: CategoryInfo;
}

export interface AnswerSubmittedData {
	nickname: string;
	total: number;
}

export interface PlayerResult {
	nickname: string;
	answer: string;
	correct: boolean;
	exactYear: boolean;
	correctAnswer: string;
}

export interface RoundRevealData {
	roundNumber: number;
	track: {
		name: string;
		artists: string[];
		albumName: string;
		releaseYear: number;
	};
	category: CategoryInfo;
	results: PlayerResult[];
}

export interface CrossPlacementData {
	correct: boolean;
	cells: number[];
}

export interface PlayerReadiedData {
	nickname: string;
	readyCount: number;
	totalCount: number;
}

export interface ScoreboardEntry {
	nickname: string;
	score: number;
}

export interface GameWonData {
	nickname: string;
	winningLine: number[];
	scoreboard: ScoreboardEntry[];
}

export interface GameOverData {
	reason: string;
	scoreboard: ScoreboardEntry[];
}

export interface GamePausedData {
	reason: string;
}
