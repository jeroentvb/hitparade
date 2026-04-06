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
 * Check if all connected players are ready. Start next round if so.
 * @param {Server} io
 * @param {GameSession} session
 */
function checkAllReady(io, session) {
	const connected = connectedPlayers(session);
	if (connected.length === 0) return;
	if (connected.every((p) => p.ready)) {
		const timer = setTimeout(() => startRound(io, session), 3000);
		addTimer(session.code, timer);
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
		io.to(session.code).emit('game-over', {
			reason: 'no-tracks',
			scoreboard: buildScoreboard(session)
		});
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

	// Pause any currently playing track before spinning
	if (session.pauseTrack && session.hostDeviceId) {
		session.pauseTrack(session.hostDeviceId).catch((err) => {
			console.error(`[game] Spotify pause failed for ${session.code}:`, err);
		});
	}

	// Emit spin event
	io.to(session.code).emit('round-spin', {
		roundNumber,
		category
	});

	// After 3s spin + 5s hold, start playback
	const playTimer = setTimeout(async () => {
		if (session.status !== 'playing' || session.currentRound !== round) return;

		round.phase = 'pre-play';

		// Try to play the track via Spotify
		if (session.playTrack && session.hostDeviceId) {
			try {
				await session.playTrack(track.uri, session.hostDeviceId);
			} catch (err) {
				console.error(`[game] Spotify playback failed for ${session.code}:`, err);
			}
		}

		// Start the answer timer regardless of playback success
		const startedAt = Date.now();
		const durationMs = 25000;
		round.timer = { startedAt, durationMs };
		round.phase = 'playing';

		io.to(session.code).emit('timer-started', {
			startedAt,
			durationMs,
			category
		});

		// Schedule reveal after timer expires
		const revealTimer = setTimeout(() => endRound(io, session, round), durationMs);
		addTimer(session.code, revealTimer);
	}, 8000);
	addTimer(session.code, playTimer);
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

				player.socketId = socket.id;
				socket.join(code.toUpperCase());
				console.log(`[socket.io] ${socket.id} registered as "${nickname}" in ${code}`);

				io.to(code.toUpperCase()).emit('lobby-update', lobbyState(session));
				if (typeof callback === 'function') callback({ ok: true });
			}
		);

		socket.on(
			'set-device-id',
			(/** @type {{ code: string; deviceId: string }} */ { code, deviceId }, callback) => {
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

				// Check for bingo
				const winningLine = checkBingo(player.scorecard);
				if (winningLine) {
					session.status = 'finished';
					clearGameTimers(session.code);
					io.to(session.code).emit('game-won', {
						nickname: player.nickname,
						winningLine,
						scoreboard: buildScoreboard(session)
					});
					io.to(session.code).emit('scorecards-update', buildScorecardsSummary(session));
					if (typeof callback === 'function') callback({ ok: true, marked: cellIndex });
					return;
				}

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

						if (session.status === 'playing') {
							// During gameplay: mark as disconnected, don't remove
							player.socketId = 'disconnected';
							player.ready = true; // Count as ready

							if (session.host.socketId === 'disconnected') {
								// Host disconnected during game — pause
								io.to(room).emit('game-paused', { reason: 'host-disconnected' });
								// Set a 60s timeout to end the game
								const pauseTimer = setTimeout(() => {
									if (session.status !== 'playing') return;
									session.status = 'finished';
									if (session.pauseTrack && session.hostDeviceId) {
										session.pauseTrack(session.hostDeviceId).catch((err) => {
											console.error(`[game] Spotify pause failed for ${session.code}:`, err);
										});
									}
									clearGameTimers(session.code);
									io.to(session.code).emit('game-over', {
										reason: 'host-left',
										scoreboard: buildScoreboard(session)
									});
								}, 60000);
								addTimer(session.code, pauseTimer);
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
