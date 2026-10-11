import { Server } from 'socket.io';
import {
	generateScorecard,
	SIDE_A_CATEGORIES,
	SIDE_B_CATEGORIES
} from './src/lib/server/game/scorecard.js';
import { checkAnswer } from './src/lib/server/game/answer-checker.js';
import { checkBingo } from './src/lib/server/game/bingo.js';

/**
 * @typedef {import('./src/lib/server/game/types.js').GameSession} GameSession
 * @typedef {import('./src/lib/server/game/types.js').RoundState} RoundState
 * @typedef {import('./src/lib/server/game/types.js').Player} Player
 */

/** @type {Map<string, NodeJS.Timeout[]>} */
const gameTimers = new Map();

/** Game codes with a playback retry in flight (guards against double taps). */
const retryingPlayback = new Set();

/**
 * @param {string} code
 * @param {NodeJS.Timeout} timer
 */
function addTimer(code, timer) {
	if (!gameTimers.has(code)) gameTimers.set(code, []);
	/** @type {NodeJS.Timeout[]} */ (gameTimers.get(code)).push(timer);
}

/** @param {string} code */
function clearGameTimers(code) {
	const timers = gameTimers.get(code);
	if (timers) {
		timers.forEach((t) => clearTimeout(t));
		gameTimers.delete(code);
	}
}

/**
 * Build a lobby-state snapshot from a game session.
 * @param {GameSession} session
 */
function lobbyState(session) {
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
			connected: p.socketId !== 'pending' && p.socketId !== 'disconnected'
		})),
		hostNickname: session.host.nickname
	};
}

/**
 * Pick a random unplayed track from the session.
 * @param {GameSession} session
 * @returns {import('./src/lib/server/game/types.js').Track | null}
 */
function pickRandomTrack(session) {
	const unplayed = session.tracks.filter((t) => !session.playedTrackUris.includes(t.uri));
	if (unplayed.length === 0) return null;
	return unplayed[Math.floor(Math.random() * unplayed.length)];
}

/**
 * Pick a random category for the session's difficulty.
 * @param {GameSession} session
 */
function pickRandomCategory(session) {
	const categories = session.config.difficulty === 'A' ? SIDE_A_CATEGORIES : SIDE_B_CATEGORIES;
	const cat = categories[Math.floor(Math.random() * categories.length)];
	return { slug: cat.slug, name: cat.name };
}

/**
 * Get connected players (socketId is not 'pending' or 'disconnected').
 * @param {GameSession} session
 * @returns {Player[]}
 */
function connectedPlayers(session) {
	return session.players.filter((p) => p.socketId !== 'pending' && p.socketId !== 'disconnected');
}

/**
 * Migrate all socketId references from a player's previous socketId to their new one.
 * Called when a player reconnects during gameplay and gets a new socket connection.
 * @param {GameSession} session
 * @param {Player} player
 * @param {string} newSocketId
 */
function migratePlayerSocketId(session, player, newSocketId) {
	const oldSocketId = player.previousSocketId || player.socketId;
	if (oldSocketId === 'disconnected' || oldSocketId === 'pending') return;

	player.previousSocketId = null;

	const round = session.currentRound;
	if (round) {
		for (const answer of round.answers) {
			if (answer.socketId === oldSocketId) {
				answer.socketId = newSocketId;
			}
		}
		if (round.results[oldSocketId] !== undefined) {
			round.results[newSocketId] = round.results[oldSocketId];
			delete round.results[oldSocketId];
		}
	}

	if (session.tiebreaker) {
		const idx = session.tiebreaker.contenderSocketIds.indexOf(oldSocketId);
		if (idx !== -1) {
			session.tiebreaker.contenderSocketIds[idx] = newSocketId;
		}
	}
}

/**
 * Build a full game state snapshot for a reconnecting player.
 * @param {GameSession} session
 * @param {Player} player
 */
function buildGameStateForPlayer(session, player) {
	const round = session.currentRound;
	const connected = connectedPlayers(session);
	const readyCount = session.players.filter((p) => p.ready).length;

	const categoryList = session.config.difficulty === 'A' ? SIDE_A_CATEGORIES : SIDE_B_CATEGORIES;

	const category = round?.selectedCategory
		? {
				slug: round.selectedCategory,
				name:
					categoryList.find((c) => c.slug === round.selectedCategory)?.name ??
					round.selectedCategory
			}
		: null;

	const revealData =
		(round?.phase === 'reveal' || round?.phase === 'cross-placement') && round?.selectedTrack
			? {
					roundNumber: round.roundNumber,
					track: {
						name: round.selectedTrack.name,
						artists: round.selectedTrack.artists,
						albumName: round.selectedTrack.albumName,
						releaseYear: round.selectedTrack.releaseYear
					},
					category,
					results: session.players.map((p) => {
						const result = round.results[p.socketId];
						return {
							nickname: p.nickname,
							answer: result?.playerAnswer ?? '',
							correct: result?.correct ?? false,
							exactYear: result?.exactYear ?? false,
							correctAnswer: result?.correctAnswer ?? ''
						};
					})
				}
			: null;

	let crossPlacementData = null;
	if (round?.phase === 'cross-placement') {
		const result = round.results[player.socketId];
		const correct = result?.correct ?? false;
		if (correct && player.scorecard) {
			const eligibleCells = [];
			for (let i = 0; i < player.scorecard.length; i++) {
				const cell = player.scorecard[i];
				if (cell.category === round.selectedCategory && !cell.marked) {
					eligibleCells.push(i);
				}
			}
			crossPlacementData = { correct: true, cells: eligibleCells };
		} else {
			crossPlacementData = { correct: false, cells: [] };
		}
	}

	let timerRemainingMs = null;
	let timerDurationMs = null;
	if (round?.timer && round.phase === 'playing') {
		const elapsed = Date.now() - round.timer.startedAt;
		timerRemainingMs = Math.max(0, round.timer.durationMs - elapsed);
		timerDurationMs = round.timer.durationMs;
	}

	/** @type {*} */
	let gameWinner = null;
	/** @type {*} */
	let gameOverData = null;

	if (session.status === 'finished' && session.finishedData) {
		if (session.finishedData.type === 'won') {
			gameWinner = {
				nickname: session.finishedData.nickname,
				winningLine: session.finishedData.winningLine ?? [],
				scoreboard: session.finishedData.scoreboard
			};
		} else {
			gameOverData = {
				reason: session.finishedData.reason,
				scoreboard: session.finishedData.scoreboard,
				coWinners: session.finishedData.coWinners
			};
		}
	}

	return {
		gameStarted: session.status !== 'lobby',
		status: session.status,
		scorecard: player.scorecard,
		scores: buildScoreboard(session),
		allScorecards: buildScorecardsSummary(session),
		readyCount,
		totalCount: connected.length,
		gamePaused: session.host.socketId === 'disconnected' || !!session.playbackFailed,
		pauseReason:
			session.host.socketId === 'disconnected'
				? 'host-disconnected'
				: session.playbackFailed
					? 'playback-failed'
					: null,
		roundNumber: round?.roundNumber ?? 0,
		roundPhase: round?.phase ?? null,
		category,
		timerRemainingMs,
		timerDurationMs,
		answerSubmitted: round ? round.answers.some((a) => a.socketId === player.socketId) : false,
		submittedCount: round?.answers.length ?? 0,
		revealData,
		crossPlacementData,
		crossPlaced: round?.phase === 'cross-placement' && player.ready,
		isTiebreaker: session.status === 'tiebreaker',
		tiebreakerContenders: session.tiebreaker
			? session.tiebreaker.contenderSocketIds.map(
					(id) => session.players.find((p) => p.socketId === id)?.nickname ?? 'Unknown'
				)
			: [],
		tiebreakerRound: session.tiebreaker?.tiebreakerRound ?? 0,
		gameWinner,
		gameOverData
	};
}

/**
 * Check if all connected players are ready. Start next round if so.
 * @param {Server} io
 * @param {GameSession} session
 */
function checkAllReady(io, session) {
	if (session.status === 'tiebreaker') return; // tiebreaker auto-advances
	const connected = connectedPlayers(session);
	if (connected.length === 0) return;
	if (connected.every((p) => p.ready)) {
		if (session.currentRound?.phase === 'cross-placement') {
			checkBingoAfterCrossPlacement(io, session);
		} else {
			const timer = setTimeout(() => startRound(io, session), 3000);
			addTimer(session.code, timer);
		}
	}
}

/**
 * Build the scoreboard from the current game state.
 * @param {GameSession} session
 */
function buildScoreboard(session) {
	return session.players.map((p) => ({
		nickname: p.nickname,
		score: p.score
	}));
}

/**
 * Build a summary of all players' scorecards for broadcasting.
 * @param {GameSession} session
 */
function buildScorecardsSummary(session) {
	return session.players.map((p) => ({
		nickname: p.nickname,
		cells: p.scorecard ? p.scorecard.map((c) => ({ category: c.category, marked: c.marked })) : [],
		winningLine: p.scorecard ? checkBingo(p.scorecard) : null
	}));
}

/**
 * Start a new round: pick category + track, emit spin, schedule playback.
 * @param {Server} io
 * @param {GameSession} session
 */
function startRound(io, session) {
	if (session.status !== 'playing') return;

	// Reset ready state
	for (const player of session.players) {
		player.ready = false;
	}

	const track = pickRandomTrack(session);
	if (!track) {
		// No tracks left — game over
		session.status = 'finished';
		if (session.pauseTrack && session.hostDeviceId) {
			session.pauseTrack(session.hostDeviceId).catch((err) => {
				console.error(`[game] Spotify pause failed for ${session.code}:`, err);
			});
		}
		const scoreboard = buildScoreboard(session);
		session.finishedData = { type: 'over', reason: 'no-tracks', scoreboard };
		io.to(session.code).emit('game-over', { reason: 'no-tracks', scoreboard });
		clearGameTimers(session.code);
		return;
	}

	const category = pickRandomCategory(session);
	const roundNumber = session.currentRound ? session.currentRound.roundNumber + 1 : 1;

	/** @type {RoundState} */
	const round = {
		roundNumber,
		phase: 'spin',
		selectedCategory: category.slug,
		selectedTrack: track,
		timer: null,
		answers: [],
		results: {}
	};
	session.currentRound = round;
	session.playedTrackUris.push(track.uri);

	// The previous track keeps playing during the spin. Pausing here lets iOS suspend
	// the Spotify app, after which the device can no longer be reached for playback.

	// Emit spin event
	io.to(session.code).emit('round-spin', {
		roundNumber,
		category
	});

	// After 3s spin + 5s hold, start playback
	const playTimer = setTimeout(() => {
		if (session.status !== 'playing' || session.currentRound !== round) return;
		beginPlayback(io, session, round);
	}, 8000);
	addTimer(session.code, playTimer);
}

/**
 * Get the category info ({ slug, name }) for a category slug.
 * @param {GameSession} session
 * @param {string} slug
 */
function categoryInfo(session, slug) {
	const categories = session.config.difficulty === 'A' ? SIDE_A_CATEGORIES : SIDE_B_CATEGORIES;
	const cat = categories.find((c) => c.slug === slug);
	return { slug, name: cat?.name ?? slug };
}

/**
 * Play the round's track on the host's device and start the answer timer.
 * If playback fails, the game is paused until the host picks a (working) device.
 * @param {Server} io
 * @param {GameSession} session
 * @param {RoundState} round
 * @returns {Promise<boolean>} whether playback started
 */
async function beginPlayback(io, session, round) {
	round.phase = 'pre-play';

	if (session.playTrack && session.hostDeviceId && round.selectedTrack) {
		try {
			await session.playTrack(round.selectedTrack.uri, session.hostDeviceId);
		} catch (err) {
			console.error(`[game] Spotify playback failed for ${session.code}:`, err);
			if (session.currentRound !== round) return false;
			session.playbackFailed = true;
			io.to(session.code).emit('game-paused', { reason: 'playback-failed' });
			return false;
		}
	}

	// The game may have ended or moved on while waiting for Spotify
	if (session.currentRound !== round || round.phase !== 'pre-play') return false;

	if (session.playbackFailed) {
		session.playbackFailed = false;
		io.to(session.code).emit('game-resumed');
	}

	const startedAt = Date.now();
	const durationMs = 30000;
	round.timer = { startedAt, durationMs };
	round.phase = 'playing';

	io.to(session.code).emit('timer-started', {
		startedAt,
		durationMs,
		category: categoryInfo(session, /** @type {string} */ (round.selectedCategory))
	});

	// Schedule reveal after timer expires
	const end = session.status === 'tiebreaker' ? endTiebreakerRound : endRound;
	const revealTimer = setTimeout(() => end(io, session, round), durationMs);
	addTimer(session.code, revealTimer);
	return true;
}

/**
 * End the round: check answers, emit reveal, schedule cross-placement.
 * @param {Server} io
 * @param {GameSession} session
 * @param {RoundState} round
 */
function endRound(io, session, round) {
	if (session.currentRound !== round || round.phase !== 'playing') return;

	round.phase = 'reveal';

	const track = /** @type {import('./src/lib/server/game/types.js').Track} */ (round.selectedTrack);
	const category = /** @type {import('./src/lib/server/game/types.js').CategorySlug} */ (
		round.selectedCategory
	);

	// Check all answers
	const playerResults = [];
	for (const player of session.players) {
		const submission = round.answers.find((a) => a.socketId === player.socketId);
		const answer = submission ? submission.answer : '';
		const result = checkAnswer(category, answer, track, session.config.fuzzyThreshold);
		round.results[player.socketId] = result;
		playerResults.push({
			nickname: player.nickname,
			answer: result.playerAnswer,
			correct: result.correct,
			exactYear: result.exactYear,
			correctAnswer: result.correctAnswer
		});
	}

	// Emit reveal to all players
	io.to(session.code).emit('round-reveal', {
		roundNumber: round.roundNumber,
		track: {
			name: track.name,
			artists: track.artists,
			albumName: track.albumName,
			releaseYear: track.releaseYear
		},
		category: {
			slug: category,
			name:
				(session.config.difficulty === 'A' ? SIDE_A_CATEGORIES : SIDE_B_CATEGORIES).find(
					(c) => c.slug === category
				)?.name ?? category
		},
		results: playerResults
	});

	// After 5s reveal, transition to cross-placement
	const crossTimer = setTimeout(() => startCrossPlacement(io, session, round), 5000);
	addTimer(session.code, crossTimer);
}

/**
 * Start cross-placement phase: tell each player whether they can place a cross.
 * @param {Server} io
 * @param {GameSession} session
 * @param {RoundState} round
 */
function startCrossPlacement(io, session, round) {
	if (session.currentRound !== round || round.phase !== 'reveal') return;

	round.phase = 'cross-placement';

	for (const player of session.players) {
		const result = round.results[player.socketId];
		const correct = result?.correct ?? false;

		if (correct && player.scorecard) {
			// Find eligible cells: unmarked cells matching the round's category
			const eligibleCells = [];
			for (let i = 0; i < player.scorecard.length; i++) {
				const cell = player.scorecard[i];
				if (cell.category === round.selectedCategory && !cell.marked) {
					eligibleCells.push(i);
				}
			}

			if (eligibleCells.length > 0) {
				io.to(player.socketId).emit('cross-placement', {
					correct: true,
					cells: eligibleCells
				});
			} else {
				// Correct but no eligible cells
				io.to(player.socketId).emit('cross-placement', {
					correct: true,
					cells: []
				});
			}
		} else {
			// Wrong answer — needs to tap Ready
			io.to(player.socketId).emit('cross-placement', {
				correct: false,
				cells: []
			});
		}
	}

	// Emit ready count
	const connected = connectedPlayers(session);
	const readyCount = session.players.filter((p) => p.ready).length;
	io.to(session.code).emit('player-readied', {
		nickname: '',
		readyCount,
		totalCount: connected.length
	});

	checkAllReady(io, session);
}

/**
 * After all players are ready in cross-placement, check ALL scorecards for bingo.
 * If multiple players have bingo, initiate a tiebreaker.
 * @param {Server} io
 * @param {GameSession} session
 */
function checkBingoAfterCrossPlacement(io, session) {
	/** @type {{ player: Player; winningLine: number[] }[]} */
	const playersWithBingo = [];
	for (const player of session.players) {
		if (player.scorecard) {
			const winningLine = checkBingo(player.scorecard);
			if (winningLine) {
				playersWithBingo.push({ player, winningLine });
			}
		}
	}

	if (playersWithBingo.length === 0) {
		// No bingo — continue to next round
		const timer = setTimeout(() => startRound(io, session), 3000);
		addTimer(session.code, timer);
	} else if (playersWithBingo.length === 1) {
		// Single winner
		const { player, winningLine } = playersWithBingo[0];
		session.status = 'finished';
		clearGameTimers(session.code);
		if (session.pauseTrack && session.hostDeviceId) {
			session.pauseTrack(session.hostDeviceId).catch((err) => {
				console.error(`[game] Spotify pause failed for ${session.code}:`, err);
			});
		}
		const scoreboard = buildScoreboard(session);
		session.finishedData = { type: 'won', nickname: player.nickname, winningLine, scoreboard };
		io.to(session.code).emit('game-won', {
			nickname: player.nickname,
			winningLine,
			scoreboard
		});
		io.to(session.code).emit('scorecards-update', buildScorecardsSummary(session));
	} else {
		// Multiple bingos — tiebreaker!
		initiateTiebreaker(io, session, playersWithBingo);
	}
}

/**
 * Start a tiebreaker when multiple players achieve bingo simultaneously.
 * @param {Server} io
 * @param {GameSession} session
 * @param {{ player: Player; winningLine: number[] }[]} playersWithBingo
 */
function initiateTiebreaker(io, session, playersWithBingo) {
	session.status = 'tiebreaker';
	session.tiebreaker = {
		contenderSocketIds: playersWithBingo.map((p) => p.player.socketId),
		tiebreakerRound: 0
	};

	if (session.pauseTrack && session.hostDeviceId) {
		session.pauseTrack(session.hostDeviceId).catch((err) => {
			console.error(`[game] Spotify pause failed for ${session.code}:`, err);
		});
	}

	io.to(session.code).emit('tiebreaker-start', {
		contenders: playersWithBingo.map((p) => p.player.nickname),
		tiebreakerRound: 1
	});
	io.to(session.code).emit('scorecards-update', buildScorecardsSummary(session));

	const timer = setTimeout(() => startTiebreakerRound(io, session), 5000);
	addTimer(session.code, timer);
}

/**
 * Start a tiebreaker round: pick category + track, emit spin, schedule playback.
 * @param {Server} io
 * @param {GameSession} session
 */
function startTiebreakerRound(io, session) {
	if (session.status !== 'tiebreaker' || !session.tiebreaker) return;

	session.tiebreaker.tiebreakerRound++;

	for (const player of session.players) {
		player.ready = false;
	}

	const track = pickRandomTrack(session);
	if (!track) {
		resolveTiebreakerByScore(io, session);
		return;
	}

	const category = pickRandomCategory(session);
	const roundNumber = session.currentRound ? session.currentRound.roundNumber + 1 : 1;

	/** @type {RoundState} */
	const round = {
		roundNumber,
		phase: 'spin',
		selectedCategory: category.slug,
		selectedTrack: track,
		timer: null,
		answers: [],
		results: {}
	};
	session.currentRound = round;
	session.playedTrackUris.push(track.uri);

	io.to(session.code).emit('round-spin', {
		roundNumber,
		category
	});

	const playTimer = setTimeout(() => {
		if (session.status !== 'tiebreaker' || session.currentRound !== round) return;
		beginPlayback(io, session, round);
	}, 8000);
	addTimer(session.code, playTimer);
}

/**
 * End a tiebreaker round: check answers, emit reveal, schedule evaluation.
 * @param {Server} io
 * @param {GameSession} session
 * @param {RoundState} round
 */
function endTiebreakerRound(io, session, round) {
	if (session.currentRound !== round || round.phase !== 'playing') return;

	round.phase = 'reveal';

	const track = /** @type {import('./src/lib/server/game/types.js').Track} */ (round.selectedTrack);
	const category = /** @type {import('./src/lib/server/game/types.js').CategorySlug} */ (
		round.selectedCategory
	);

	const playerResults = [];
	for (const player of session.players) {
		const submission = round.answers.find((a) => a.socketId === player.socketId);
		const answer = submission ? submission.answer : '';
		const result = checkAnswer(category, answer, track, session.config.fuzzyThreshold);
		round.results[player.socketId] = result;
		playerResults.push({
			nickname: player.nickname,
			answer: result.playerAnswer,
			correct: result.correct,
			exactYear: result.exactYear,
			correctAnswer: result.correctAnswer
		});
	}

	io.to(session.code).emit('round-reveal', {
		roundNumber: round.roundNumber,
		track: {
			name: track.name,
			artists: track.artists,
			albumName: track.albumName,
			releaseYear: track.releaseYear
		},
		category: {
			slug: category,
			name:
				(session.config.difficulty === 'A' ? SIDE_A_CATEGORIES : SIDE_B_CATEGORIES).find(
					(c) => c.slug === category
				)?.name ?? category
		},
		results: playerResults
	});

	const evalTimer = setTimeout(() => evaluateTiebreaker(io, session, round), 5000);
	addTimer(session.code, evalTimer);
}

/**
 * Evaluate tiebreaker results: eliminate, narrow, or replay.
 * @param {Server} io
 * @param {GameSession} session
 * @param {RoundState} round
 */
function evaluateTiebreaker(io, session, round) {
	if (session.status !== 'tiebreaker' || !session.tiebreaker) return;

	const contenderIds = session.tiebreaker.contenderSocketIds;
	const correctContenders = contenderIds.filter((id) => {
		const result = round.results[id];
		return result?.correct;
	});

	if (correctContenders.length === 1) {
		// Exactly one correct — winner!
		const winner = session.players.find((p) => p.socketId === correctContenders[0]);
		const winningLine = winner?.scorecard ? checkBingo(winner.scorecard) : null;
		session.status = 'finished';
		session.tiebreaker = null;
		clearGameTimers(session.code);
		if (session.pauseTrack && session.hostDeviceId) {
			session.pauseTrack(session.hostDeviceId).catch((err) => {
				console.error(`[game] Spotify pause failed for ${session.code}:`, err);
			});
		}
		const scoreboard = buildScoreboard(session);
		session.finishedData = {
			type: 'won',
			nickname: winner?.nickname ?? 'Unknown',
			winningLine: winningLine ?? [],
			scoreboard
		};
		io.to(session.code).emit('game-won', {
			nickname: winner?.nickname ?? 'Unknown',
			winningLine: winningLine ?? [],
			scoreboard
		});
		io.to(session.code).emit('scorecards-update', buildScorecardsSummary(session));
	} else if (correctContenders.length > 1) {
		// Multiple correct — narrow contenders
		const eliminated = contenderIds.filter((id) => !correctContenders.includes(id));
		session.tiebreaker.contenderSocketIds = correctContenders;

		io.to(session.code).emit('tiebreaker-update', {
			eliminated: eliminated.map(
				(id) => session.players.find((p) => p.socketId === id)?.nickname ?? 'Unknown'
			),
			remaining: correctContenders.map(
				(id) => session.players.find((p) => p.socketId === id)?.nickname ?? 'Unknown'
			),
			tiebreakerRound: session.tiebreaker.tiebreakerRound
		});

		const timer = setTimeout(() => startTiebreakerRound(io, session), 5000);
		addTimer(session.code, timer);
	} else {
		// Zero correct — all contenders continue
		io.to(session.code).emit('tiebreaker-update', {
			eliminated: [],
			remaining: contenderIds.map(
				(id) => session.players.find((p) => p.socketId === id)?.nickname ?? 'Unknown'
			),
			tiebreakerRound: session.tiebreaker.tiebreakerRound
		});

		const timer = setTimeout(() => startTiebreakerRound(io, session), 5000);
		addTimer(session.code, timer);
	}
}

/**
 * Resolve tiebreaker when no tracks remain: highest-scoring contender wins.
 * @param {Server} io
 * @param {GameSession} session
 */
function resolveTiebreakerByScore(io, session) {
	if (!session.tiebreaker) return;

	const contenders = session.tiebreaker.contenderSocketIds
		.map((id) => session.players.find((p) => p.socketId === id))
		.filter(/** @param {Player | undefined} p @returns {p is Player} */ (p) => !!p);

	const maxScore = Math.max(...contenders.map((p) => p.score));
	const winners = contenders.filter((p) => p.score === maxScore);

	session.status = 'finished';
	session.tiebreaker = null;
	clearGameTimers(session.code);
	if (session.pauseTrack && session.hostDeviceId) {
		session.pauseTrack(session.hostDeviceId).catch((err) => {
			console.error(`[game] Spotify pause failed for ${session.code}:`, err);
		});
	}

	const scoreboard = buildScoreboard(session);
	if (winners.length === 1) {
		const winner = winners[0];
		const winningLine = winner.scorecard ? checkBingo(winner.scorecard) : null;
		session.finishedData = {
			type: 'won',
			nickname: winner.nickname,
			winningLine: winningLine ?? [],
			scoreboard
		};
		io.to(session.code).emit('game-won', {
			nickname: winner.nickname,
			winningLine: winningLine ?? [],
			scoreboard
		});
	} else {
		const coWinners = winners.map((p) => p.nickname);
		session.finishedData = { type: 'over', reason: 'tiebreaker-draw', scoreboard, coWinners };
		io.to(session.code).emit('game-over', {
			reason: 'tiebreaker-draw',
			scoreboard,
			coWinners
		});
	}
	io.to(session.code).emit('scorecards-update', buildScorecardsSummary(session));
}

/**
 * Attach Socket.IO to an HTTP server and set up room management.
 * @param {import('node:http').Server} httpServer
 * @param {Map<string, GameSession>} [gamesMap]
 * @returns {Server}
 */
export function setupSocketIO(httpServer, gamesMap) {
	const io = new Server(httpServer, {
		cors: {
			origin: '*'
		}
	});

	io.on('connection', (socket) => {
		console.log(`[socket.io] client connected: ${socket.id}`);

		socket.on('join-room', (roomCode, callback) => {
			socket.join(roomCode);
			socket.to(roomCode).emit('player-joined', { id: socket.id });
			console.log(`[socket.io] ${socket.id} joined room ${roomCode}`);
			if (typeof callback === 'function') callback({ ok: true });
		});

		socket.on('leave-room', (roomCode) => {
			socket.leave(roomCode);
			socket.to(roomCode).emit('player-left', { id: socket.id });
			console.log(`[socket.io] ${socket.id} left room ${roomCode}`);
		});

		socket.on(
			'register-player',
			(/** @type {{ code: string; nickname: string }} */ { code, nickname }, callback) => {
				if (!gamesMap) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Server not ready' });
					return;
				}

				const session = gamesMap.get(code.toUpperCase());
				if (!session) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Game not found' });
					return;
				}

				const player = session.players.find(
					(p) => p.nickname.toLowerCase() === nickname.toLowerCase()
				);
				if (!player) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Player not found' });
					return;
				}

				const isGameplay =
					session.status === 'playing' ||
					session.status === 'tiebreaker' ||
					session.status === 'finished';

				if (isGameplay) {
					migratePlayerSocketId(session, player, socket.id);
				}

				player.socketId = socket.id;
				socket.join(code.toUpperCase());
				console.log(`[socket.io] ${socket.id} registered as "${nickname}" in ${code}`);

				if (isGameplay) {
					if (session.host === player && session.pauseTimer) {
						clearTimeout(session.pauseTimer);
						session.pauseTimer = null;
						if (session.playbackFailed) {
							// Still paused: the host needs to fix playback first
							io.to(code.toUpperCase()).emit('game-paused', { reason: 'playback-failed' });
						} else {
							io.to(code.toUpperCase()).emit('game-resumed');
						}
						console.log(`[socket.io] host "${nickname}" reconnected in ${code}`);
					}

					io.to(player.socketId).emit('game-state-sync', buildGameStateForPlayer(session, player));

					io.to(code.toUpperCase()).emit('lobby-update', lobbyState(session));

					const connected = connectedPlayers(session);
					const readyCount = session.players.filter((p) => p.ready).length;
					io.to(session.code).emit('player-readied', {
						nickname: '',
						readyCount,
						totalCount: connected.length
					});
				} else {
					io.to(code.toUpperCase()).emit('lobby-update', lobbyState(session));
				}

				if (typeof callback === 'function') callback({ ok: true });
			}
		);

		socket.on(
			'set-device-id',
			async (/** @type {{ code: string; deviceId: string }} */ { code, deviceId }, callback) => {
				if (!gamesMap) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Server not ready' });
					return;
				}

				const session = gamesMap.get(code.toUpperCase());
				if (!session) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Game not found' });
					return;
				}

				if (session.host.socketId !== socket.id) {
					if (typeof callback === 'function')
						callback({ ok: false, error: 'Only the host can set the device' });
					return;
				}

				session.hostDeviceId = deviceId;
				console.log(`[socket.io] device set for game ${code}: ${deviceId}`);

				// Game is paused because playback failed: retry the current round on this device
				const round = session.currentRound;
				if (session.playbackFailed && round?.phase === 'pre-play') {
					if (retryingPlayback.has(session.code)) {
						if (typeof callback === 'function')
							callback({ ok: false, error: 'Already trying to start playback' });
						return;
					}
					retryingPlayback.add(session.code);
					const started = await beginPlayback(io, session, round).finally(() =>
						retryingPlayback.delete(session.code)
					);
					if (typeof callback === 'function') {
						callback(
							started
								? { ok: true }
								: {
										ok: false,
										error:
											'Spotify could not play on this device. Open Spotify on it and try again, or choose another device.'
									}
						);
					}
					return;
				}

				if (typeof callback === 'function') callback({ ok: true });
			}
		);

		socket.on('start-game', (/** @type {{ code: string }} */ { code }, callback) => {
			if (!gamesMap) {
				if (typeof callback === 'function') callback({ ok: false, error: 'Server not ready' });
				return;
			}

			const session = gamesMap.get(code.toUpperCase());
			if (!session) {
				if (typeof callback === 'function') callback({ ok: false, error: 'Game not found' });
				return;
			}

			if (session.host.socketId !== socket.id) {
				if (typeof callback === 'function')
					callback({ ok: false, error: 'Only the host can start the game' });
				return;
			}

			const connectedCount = session.players.filter(
				(p) => p.socketId !== 'pending' && p.socketId !== 'disconnected'
			).length;
			if (connectedCount < 2) {
				if (typeof callback === 'function')
					callback({
						ok: false,
						error: 'Need at least 2 connected players'
					});
				return;
			}

			if (!session.hostDeviceId) {
				if (typeof callback === 'function')
					callback({ ok: false, error: 'No playback device selected' });
				return;
			}

			session.status = 'playing';
			for (const player of session.players) {
				player.scorecard = generateScorecard(session.config.difficulty);
			}
			for (const player of session.players) {
				io.to(player.socketId).emit('game-started', {
					code: session.code,
					scorecard: player.scorecard
				});
			}
			io.to(session.code).emit('scores-update', buildScoreboard(session));
			io.to(session.code).emit('scorecards-update', buildScorecardsSummary(session));
			console.log(`[socket.io] game ${code} started`);
			if (typeof callback === 'function') callback({ ok: true });

			// Start first round after a short delay
			const timer = setTimeout(() => startRound(io, session), 3000);
			addTimer(session.code, timer);
		});

		socket.on(
			'submit-answer',
			(/** @type {{ code: string; answer: string }} */ { code, answer }, callback) => {
				if (!gamesMap) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Server not ready' });
					return;
				}

				const session = gamesMap.get(code.toUpperCase());
				if (!session) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Game not found' });
					return;
				}

				const round = session.currentRound;
				if (!round || round.phase !== 'playing') {
					if (typeof callback === 'function')
						callback({ ok: false, error: 'Not in playing phase' });
					return;
				}

				// During tiebreaker, only contenders can submit answers
				if (session.status === 'tiebreaker' && session.tiebreaker) {
					if (!session.tiebreaker.contenderSocketIds.includes(socket.id)) {
						if (typeof callback === 'function')
							callback({ ok: false, error: 'Spectators cannot submit answers' });
						return;
					}
				}

				// Check timer hasn't expired (5s grace period for slow connections)
				if (round.timer) {
					const elapsed = Date.now() - round.timer.startedAt;
					if (elapsed > round.timer.durationMs + 5000) {
						if (typeof callback === 'function') callback({ ok: false, error: 'Time is up' });
						return;
					}
				}

				// Check not already submitted
				if (round.answers.find((a) => a.socketId === socket.id)) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Already submitted' });
					return;
				}

				round.answers.push({
					socketId: socket.id,
					answer,
					timestamp: Date.now()
				});

				const player = session.players.find((p) => p.socketId === socket.id);
				const nickname = player ? player.nickname : 'Unknown';

				io.to(session.code).emit('answer-submitted', {
					nickname,
					total: round.answers.length
				});

				if (typeof callback === 'function') callback({ ok: true });
			}
		);

		socket.on(
			'place-cross',
			(/** @type {{ code: string; cellIndex: number }} */ { code, cellIndex }, callback) => {
				if (!gamesMap) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Server not ready' });
					return;
				}

				const session = gamesMap.get(code.toUpperCase());
				if (!session) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Game not found' });
					return;
				}

				const round = session.currentRound;
				if (!round || round.phase !== 'cross-placement') {
					if (typeof callback === 'function')
						callback({ ok: false, error: 'Not in cross-placement phase' });
					return;
				}

				const player = session.players.find((p) => p.socketId === socket.id);
				if (!player || !player.scorecard) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Player not found' });
					return;
				}

				// Verify player answered correctly
				const result = round.results[socket.id];
				if (!result?.correct) {
					if (typeof callback === 'function')
						callback({ ok: false, error: 'Answer was not correct' });
					return;
				}

				// Validate cell
				if (cellIndex < 0 || cellIndex >= player.scorecard.length) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Invalid cell index' });
					return;
				}

				const cell = player.scorecard[cellIndex];
				if (cell.category !== round.selectedCategory) {
					if (typeof callback === 'function')
						callback({ ok: false, error: 'Cell does not match category' });
					return;
				}

				if (cell.marked) {
					if (typeof callback === 'function') callback({ ok: false, error: 'Cell already marked' });
					return;
				}

				// Mark the cell
				cell.marked = true;
				player.score += result.exactYear ? 2 : 1;
				player.ready = true;

				if (typeof callback === 'function') callback({ ok: true, marked: cellIndex });

				// Emit updated scores
				io.to(session.code).emit('scores-update', buildScoreboard(session));
				io.to(session.code).emit('scorecards-update', buildScorecardsSummary(session));

				// Emit updated ready count
				const connected = connectedPlayers(session);
				const readyCount = session.players.filter((p) => p.ready).length;
				io.to(session.code).emit('player-readied', {
					nickname: player.nickname,
					readyCount,
					totalCount: connected.length
				});

				checkAllReady(io, session);
			}
		);

		socket.on('player-ready', (/** @type {{ code: string }} */ { code }, callback) => {
			if (!gamesMap) {
				if (typeof callback === 'function') callback({ ok: false, error: 'Server not ready' });
				return;
			}

			const session = gamesMap.get(code.toUpperCase());
			if (!session) {
				if (typeof callback === 'function') callback({ ok: false, error: 'Game not found' });
				return;
			}

			const player = session.players.find((p) => p.socketId === socket.id);
			if (!player) {
				if (typeof callback === 'function') callback({ ok: false, error: 'Player not found' });
				return;
			}

			player.ready = true;

			const connected = connectedPlayers(session);
			const readyCount = session.players.filter((p) => p.ready).length;

			io.to(session.code).emit('player-readied', {
				nickname: player.nickname,
				readyCount,
				totalCount: connected.length
			});

			if (typeof callback === 'function') callback({ ok: true });

			checkAllReady(io, session);
		});

		socket.on('room-message', ({ roomCode, event, data }) => {
			socket.to(roomCode).emit(event, data);
		});

		socket.on('disconnecting', () => {
			for (const room of socket.rooms) {
				if (room === socket.id) continue;
				socket.to(room).emit('player-left', { id: socket.id });

				if (gamesMap) {
					const session = gamesMap.get(room);
					if (session) {
						const player = session.players.find((p) => p.socketId === socket.id);
						if (!player) continue;

						if (session.status === 'playing' || session.status === 'tiebreaker') {
							const disconnectedSocketId = player.socketId;
							// During gameplay: mark as disconnected, don't remove
							player.previousSocketId = player.socketId;
							player.socketId = 'disconnected';
							player.ready = true; // Count as ready

							// Tiebreaker-specific: eliminate disconnected contender
							if (session.status === 'tiebreaker' && session.tiebreaker) {
								const tb = session.tiebreaker;
								const idx = tb.contenderSocketIds.indexOf(disconnectedSocketId);
								if (idx !== -1) {
									tb.contenderSocketIds.splice(idx, 1);

									if (tb.contenderSocketIds.length === 1) {
										// Last contender standing wins
										const lastContender = session.players.find(
											(p) => p.socketId === tb.contenderSocketIds[0]
										);
										if (lastContender) {
											session.status = 'finished';
											const winningLine = lastContender.scorecard
												? checkBingo(lastContender.scorecard)
												: null;
											clearGameTimers(session.code);
											session.tiebreaker = null;
											const scoreboard = buildScoreboard(session);
											session.finishedData = {
												type: 'won',
												nickname: lastContender.nickname,
												winningLine: winningLine ?? [],
												scoreboard
											};
											io.to(session.code).emit('game-won', {
												nickname: lastContender.nickname,
												winningLine: winningLine ?? [],
												scoreboard
											});
											io.to(session.code).emit(
												'scorecards-update',
												buildScorecardsSummary(session)
											);
										}
									} else if (tb.contenderSocketIds.length === 0) {
										// All contenders disconnected
										session.status = 'finished';
										clearGameTimers(session.code);
										session.tiebreaker = null;
										const scoreboard = buildScoreboard(session);
										session.finishedData = {
											type: 'over',
											reason: 'all-contenders-left',
											scoreboard
										};
										io.to(session.code).emit('game-over', {
											reason: 'all-contenders-left',
											scoreboard
										});
									} else {
										io.to(session.code).emit('tiebreaker-update', {
											eliminated: [player.nickname],
											remaining: tb.contenderSocketIds.map(
												(id) =>
													session.players.find((p) => p.socketId === id)?.nickname ?? 'Unknown'
											),
											tiebreakerRound: tb.tiebreakerRound
										});
									}
								}
							}

							if (session.host.socketId === 'disconnected') {
								// Host disconnected during game — pause
								io.to(room).emit('game-paused', { reason: 'host-disconnected' });
								// Set a 60s timeout to end the game (stored on session for cancellation on reconnect)
								session.pauseTimer = setTimeout(() => {
									session.pauseTimer = null;
									if (session.status !== 'playing' && session.status !== 'tiebreaker') return;
									session.status = 'finished';
									session.tiebreaker = null;
									if (session.pauseTrack && session.hostDeviceId) {
										session.pauseTrack(session.hostDeviceId).catch((err) => {
											console.error(`[game] Spotify pause failed for ${session.code}:`, err);
										});
									}
									clearGameTimers(session.code);
									const scoreboard = buildScoreboard(session);
									session.finishedData = { type: 'over', reason: 'host-left', scoreboard };
									io.to(session.code).emit('game-over', {
										reason: 'host-left',
										scoreboard
									});
								}, 60000);
							}

							checkAllReady(io, session);
						} else {
							// In lobby: remove the player entirely
							const index = session.players.indexOf(player);
							if (index !== -1) session.players.splice(index, 1);

							if (session.players.length === 0) {
								gamesMap.delete(room);
								clearGameTimers(room);
								console.log(`[socket.io] game ${room} deleted (empty)`);
							} else {
								if (session.host === player) {
									session.host = session.players[0];
								}
								io.to(room).emit('lobby-update', lobbyState(session));
							}
						}
					}
				}
			}
		});

		socket.on('disconnect', () => {
			console.log(`[socket.io] client disconnected: ${socket.id}`);
		});
	});

	return io;
}
