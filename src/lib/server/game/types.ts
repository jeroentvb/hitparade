export type Difficulty = 'A' | 'B';

export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface GameConfig {
	difficulty: Difficulty;
	fuzzyThreshold: number;
	maxPlayers: number;
	playlistName: string;
}

export interface LobbyPlayer {
	nickname: string;
	connected: boolean;
}

export interface LobbyState {
	code: string;
	status: GameStatus;
	config: {
		difficulty: Difficulty;
		playlistName: string;
		fuzzyThreshold: number;
		maxPlayers: number;
	};
	players: LobbyPlayer[];
	hostNickname: string;
}

export interface Track {
	uri: string;
	name: string;
	artists: string[];
	albumName: string;
	releaseYear: number;
	isGroup: boolean;
}

export interface ScorecardCell {
	category: string;
	marked: boolean;
}

export type Scorecard = ScorecardCell[];

export interface Player {
	socketId: string;
	nickname: string;
	scorecard: Scorecard | null;
	score: number;
	ready: boolean;
}

export interface SubmittedAnswer {
	socketId: string;
	answer: string;
	timestamp: number;
}

export interface TimerState {
	startedAt: number;
	durationMs: number;
}

export interface RoundState {
	roundNumber: number;
	selectedCategory: string | null;
	selectedTrack: Track | null;
	timer: TimerState | null;
	answers: SubmittedAnswer[];
}

export interface GameSession {
	code: string;
	config: GameConfig;
	host: Player;
	players: Player[];
	tracks: Track[];
	playedTrackUris: string[];
	currentRound: RoundState | null;
	status: GameStatus;
	createdAt: number;
}
