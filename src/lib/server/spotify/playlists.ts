import type { SpotifyApi, Track as SpotifyTrack, MaxInt } from '@spotify/web-api-ts-sdk';
import type { PlaylistSummary } from './types.js';
import type { Track } from '$lib/server/game/types.js';

const PLAYLIST_PAGE_SIZE = 50 as MaxInt<50>;
const TRACK_PAGE_SIZE = 50 as MaxInt<50>;

const PLAYLIST_ID_RE = /(?:spotify:playlist:|open\.spotify\.com\/playlist\/)([a-zA-Z0-9]+)/;
const BARE_ID_RE = /^[a-zA-Z0-9]{22}$/;

export function parsePlaylistId(input: string): string | null {
	const match = input.match(PLAYLIST_ID_RE);
	if (match) return match[1];
	if (BARE_ID_RE.test(input.trim())) return input.trim();
	return null;
}

export async function fetchUserPlaylists(client: SpotifyApi): Promise<PlaylistSummary[]> {
	const playlists: PlaylistSummary[] = [];
	let offset = 0;

	for (;;) {
		const page = await client.currentUser.playlists.playlists(PLAYLIST_PAGE_SIZE, offset);

		for (const item of page.items) {
			playlists.push({
				id: item.id,
				name: item.name,
				imageUrl: item.images?.[0]?.url ?? null,
				trackCount: item.tracks?.total ?? 0,
				owner: item.owner.display_name
			});
		}

		if (!page.next) break;
		offset += PLAYLIST_PAGE_SIZE;
	}

	return playlists;
}

export async function fetchPlaylistTracks(
	client: SpotifyApi,
	playlistId: string
): Promise<{ tracks: Track[]; skippedCount: number }> {
	const tracks: Track[] = [];
	let skippedCount = 0;
	let offset = 0;

	for (;;) {
		const page = await client.playlists.getPlaylistItems(
			playlistId,
			undefined,
			undefined,
			TRACK_PAGE_SIZE,
			offset
		);

		for (const item of page.items) {
			if (item.is_local) {
				skippedCount++;
				continue;
			}

			const track = item.track;
			if (!track || track.type !== 'track') {
				skippedCount++;
				continue;
			}

			const spotifyTrack = track as SpotifyTrack;
			const album = spotifyTrack.album;

			if (
				!spotifyTrack.name ||
				!spotifyTrack.artists?.length ||
				!album?.name ||
				!album?.release_date
			) {
				skippedCount++;
				continue;
			}

			tracks.push({
				uri: spotifyTrack.uri,
				name: spotifyTrack.name,
				artists: spotifyTrack.artists.map((a) => a.name),
				albumName: album.name,
				releaseYear: parseInt(album.release_date.substring(0, 4), 10),
				isGroup: spotifyTrack.artists.length > 1
			});
		}

		if (!page.next) break;
		offset += TRACK_PAGE_SIZE;
	}

	return { tracks, skippedCount };
}
