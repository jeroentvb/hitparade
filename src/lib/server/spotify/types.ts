import type { SpotifyApi } from '@spotify/web-api-ts-sdk';

export interface SpotifySession {
	client: SpotifyApi;
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
