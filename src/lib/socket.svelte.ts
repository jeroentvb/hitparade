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
