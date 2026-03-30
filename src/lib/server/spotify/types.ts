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

export interface PlaylistSummary {
	id: string;
	name: string;
	imageUrl: string | null;
	trackCount: number;
	owner: string;
}
