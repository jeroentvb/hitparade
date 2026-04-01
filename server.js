import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { setupSocketIO } from './socket-setup.js';

const server = createServer(handler);
const gamesMap = globalThis.__hitparade_games;
setupSocketIO(server, gamesMap);

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
	console.log(`Server listening on ${host}:${port}`);
});
