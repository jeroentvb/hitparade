import { Server } from 'socket.io';

/**
 * @typedef {{
 *   code: string;
 *   status: string;
 *   config: { difficulty: string; playlistName: string; fuzzyThreshold: number; maxPlayers: number };
 *   host: { socketId: string; nickname: string };
 *   players: Array<{ socketId: string; nickname: string }>;
 * }} GameSession
 */

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
			connected: p.socketId !== 'pending'
		})),
		hostNickname: session.host.nickname
	};
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

			const connectedCount = session.players.filter((p) => p.socketId !== 'pending').length;
			if (connectedCount < 2) {
				if (typeof callback === 'function')
					callback({
						ok: false,
						error: 'Need at least 2 connected players'
					});
				return;
			}

			session.status = 'playing';
			io.to(code.toUpperCase()).emit('game-started', {
				code: session.code
			});
			console.log(`[socket.io] game ${code} started`);
			if (typeof callback === 'function') callback({ ok: true });
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
						const index = session.players.findIndex((p) => p.socketId === socket.id);
						if (index !== -1) {
							session.players.splice(index, 1);

							if (session.players.length === 0) {
								gamesMap.delete(room);
								console.log(`[socket.io] game ${room} deleted (empty)`);
							} else {
								if (session.host.socketId === socket.id) {
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
