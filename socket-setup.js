import { Server } from 'socket.io';

/**
 * Attach Socket.IO to an HTTP server and set up room management.
 * @param {import('node:http').Server} httpServer
 * @returns {Server}
 */
export function setupSocketIO(httpServer) {
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

		socket.on('room-message', ({ roomCode, event, data }) => {
			socket.to(roomCode).emit(event, data);
		});

		socket.on('disconnecting', () => {
			for (const room of socket.rooms) {
				if (room !== socket.id) {
					socket.to(room).emit('player-left', { id: socket.id });
				}
			}
		});

		socket.on('disconnect', () => {
			console.log(`[socket.io] client disconnected: ${socket.id}`);
		});
	});

	return io;
}
