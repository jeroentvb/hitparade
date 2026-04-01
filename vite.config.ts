import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

function socketPlugin(): Plugin {
	return {
		name: 'socket-io-dev',
		configureServer(server) {
			if (!server.httpServer) return;
			Promise.all([import('./socket-setup.js'), import('./src/lib/server/game/store.js')]).then(
				([{ setupSocketIO }]) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const gamesMap = (globalThis as any).__hitparade_games;
					setupSocketIO(server.httpServer as import('node:http').Server, gamesMap);
					console.log('[vite] Socket.IO attached to dev server');
				}
			);
		}
	};
}

export default defineConfig({ plugins: [tailwindcss(), sveltekit(), socketPlugin()] });
