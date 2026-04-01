import { SpotifyApi, type IAuthStrategy, type AccessToken } from '@spotify/web-api-ts-sdk';
import {
	SPOTIFY_CLIENT_ID,
	SPOTIFY_CLIENT_SECRET,
	SPOTIFY_REDIRECT_URI
} from '$env/static/private';
import type { SpotifySession } from './types.js';

const sessions = new Map<string, SpotifySession>();

const SCOPES = [
	'streaming',
	'user-read-email',
	'user-read-private',
	'playlist-read-private',
	'playlist-read-collaborative',
	'user-modify-playback-state',
	'user-read-playback-state'
];

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';

class ServerAuthStrategy implements IAuthStrategy {
	private token: AccessToken;

	constructor(token: AccessToken) {
		this.token = token;
		if (!this.token.expires) {
			this.token.expires = Date.now() + token.expires_in * 1000;
		}
	}

	setConfiguration(): void {}

	async getOrCreateAccessToken(): Promise<AccessToken> {
		if (this.token.expires && this.token.expires <= Date.now()) {
			this.token = await refreshWithSecret(this.token);
		}
		return this.token;
	}

	async getAccessToken(): Promise<AccessToken | null> {
		return this.token;
	}

	removeAccessToken(): void {
		this.token = { access_token: '', token_type: '', expires_in: 0, refresh_token: '' };
	}
}

async function refreshWithSecret(token: AccessToken): Promise<AccessToken> {
	const res = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: token.refresh_token
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Token refresh failed: ${res.status} ${body}`);
	}

	const data = await res.json();
	return {
		access_token: data.access_token,
		token_type: 'Bearer',
		expires_in: data.expires_in,
		refresh_token: data.refresh_token ?? token.refresh_token,
		expires: Date.now() + data.expires_in * 1000
	};
}

export function generateAuthUrl(state: string): string {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: SPOTIFY_CLIENT_ID,
		scope: SCOPES.join(' '),
		redirect_uri: SPOTIFY_REDIRECT_URI,
		state
	});
	return `${AUTHORIZE_ENDPOINT}?${params}`;
}

export async function exchangeCode(code: string): Promise<AccessToken> {
	const res = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: SPOTIFY_REDIRECT_URI
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Token exchange failed: ${res.status} ${body}`);
	}

	const data = await res.json();
	return {
		access_token: data.access_token,
		token_type: 'Bearer',
		expires_in: data.expires_in,
		refresh_token: data.refresh_token,
		expires: Date.now() + data.expires_in * 1000
	};
}

export function createClient(token: AccessToken): SpotifyApi {
	return new SpotifyApi(new ServerAuthStrategy(token));
}

export function storeSession(sessionId: string, session: SpotifySession): void {
	sessions.set(sessionId, session);
}

export function getSession(sessionId: string): SpotifySession | undefined {
	return sessions.get(sessionId);
}

export function removeSession(sessionId: string): void {
	sessions.delete(sessionId);
}

export function getClient(sessionId: string): SpotifyApi {
	const session = sessions.get(sessionId);
	if (!session) throw new Error('Session not found');
	return session.client;
}

export function generateSessionId(): string {
	return crypto.randomUUID();
}

export function generateState(): string {
	return crypto.randomUUID();
}
