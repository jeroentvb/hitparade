import { getClient } from './auth.js';

export async function getDevices(sessionId: string) {
	const client = getClient(sessionId);
	const { devices } = await client.player.getAvailableDevices();
	return devices;
}

export async function play(sessionId: string, trackUri: string, deviceId: string) {
	const client = getClient(sessionId);
	await client.player.startResumePlayback(deviceId, undefined, [trackUri]);
}

export async function pause(sessionId: string, deviceId: string) {
	const client = getClient(sessionId);
	try {
		await client.player.pausePlayback(deviceId);
	} catch (e) {
		// Spotify returns 204 No Content for pause, but the SDK tries to JSON.parse the empty body.
		// The pause still succeeds, so ignore the parse error.
		if (!(e instanceof SyntaxError)) throw e;
	}
}

export async function resume(sessionId: string, deviceId: string) {
	const client = getClient(sessionId);
	await client.player.startResumePlayback(deviceId);
}

export async function getPlaybackState(sessionId: string) {
	const client = getClient(sessionId);
	return client.player.getPlaybackState();
}
