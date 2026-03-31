import type { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { getValidTokens, getSpotifyClient } from './auth.js';

async function getClient(sessionId: string): Promise<SpotifyApi> {
	const tokens = await getValidTokens(sessionId);
	if (!tokens) throw new Error('Session expired');
	return getSpotifyClient(tokens);
}

export async function getDevices(sessionId: string) {
	const client = await getClient(sessionId);
	const { devices } = await client.player.getAvailableDevices();
	return devices;
}

export async function play(sessionId: string, trackUri: string, deviceId: string) {
	const client = await getClient(sessionId);
	await client.player.startResumePlayback(deviceId, undefined, [trackUri]);
}

export async function pause(sessionId: string, deviceId: string) {
	const client = await getClient(sessionId);
	await client.player.pausePlayback(deviceId);
}

export async function resume(sessionId: string, deviceId: string) {
	const client = await getClient(sessionId);
	await client.player.startResumePlayback(deviceId);
}

export async function getPlaybackState(sessionId: string) {
	const client = await getClient(sessionId);
	return client.player.getPlaybackState();
}
