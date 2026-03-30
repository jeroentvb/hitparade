import { SpotifyApi, type AccessToken } from '@spotify/web-api-ts-sdk';
import {
	SPOTIFY_CLIENT_ID,
	SPOTIFY_CLIENT_SECRET,
	SPOTIFY_REDIRECT_URI
} from '$env/static/private';
import type { SpotifySession, SpotifyTokens } from './types.js';

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

export async function exchangeCode(code: string): Promise<SpotifyTokens> {
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
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000
	};
}

async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
	const res = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Token refresh failed: ${res.status} ${body}`);
	}

	const data = await res.json();
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? refreshToken,
		expiresAt: Date.now() + data.expires_in * 1000
	};
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

export async function getValidTokens(sessionId: string): Promise<SpotifyTokens | undefined> {
	const session = sessions.get(sessionId);
	if (!session) return undefined;

	// Refresh if token expires within 60 seconds
	if (Date.now() > session.tokens.expiresAt - 60_000) {
		const refreshed = await refreshAccessToken(session.tokens.refreshToken);
		session.tokens = refreshed;
	}

	return session.tokens;
}

export function getSpotifyClient(tokens: SpotifyTokens): SpotifyApi {
	const accessToken: AccessToken = {
		access_token: tokens.accessToken,
		token_type: 'Bearer',
		expires_in: Math.floor((tokens.expiresAt - Date.now()) / 1000),
		refresh_token: tokens.refreshToken
	};
	return SpotifyApi.withAccessToken(SPOTIFY_CLIENT_ID, accessToken);
}

export function generateSessionId(): string {
	return crypto.randomUUID();
}

export function generateState(): string {
	return crypto.randomUUID();
}
