import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

function socketPlugin(): Plugin {
	return {
		name: 'socket-io-dev',
		configureServer(server) {
			if (!server.httpServer) return;
			import('./socket-setup.js').then(({ setupSocketIO }) => {
				setupSocketIO(server.httpServer as import('node:http').Server);
				console.log('[vite] Socket.IO attached to dev server');
			});
		}
	};
}

export default defineConfig({ plugins: [tailwindcss(), sveltekit(), socketPlugin()] });
