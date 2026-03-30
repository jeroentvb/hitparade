export interface SpotifyTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

export interface SpotifySession {
	tokens: SpotifyTokens;
	userId: string;
	displayName: string;
}
