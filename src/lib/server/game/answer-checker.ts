import { distance } from 'fastest-levenshtein';
import type { AnswerResult, Track } from './types.js';
import type { CategorySlug } from './scorecard.js';

const DECADE_WORDS: Record<string, number> = {
	twenties: 1920,
	thirties: 1930,
	forties: 1940,
	fifties: 1950,
	sixties: 1960,
	seventies: 1970,
	eighties: 1980,
	nineties: 1990,
	thousands: 2000,
	tens: 2010,
	'two thousands': 2000
};

function result(
	correct: boolean,
	exactYear: boolean,
	playerAnswer: string,
	correctAnswer: string
): AnswerResult {
	return { correct, exactYear, playerAnswer, correctAnswer };
}

function parseYear(input: string): number | null {
	const match = input.match(/\d{4}/);
	if (match) return parseInt(match[0], 10);

	const short = input.match(/\d{2}/);
	if (short) {
		const n = parseInt(short[0], 10);
		return n >= 0 && n <= 99 ? (n < 30 ? 2000 + n : 1900 + n) : null;
	}

	return null;
}

function parseDecade(input: string): number | null {
	const normalized = input.toLowerCase().trim();

	// Word forms: "the eighties", "eighties"
	for (const [word, decade] of Object.entries(DECADE_WORDS)) {
		if (normalized.includes(word)) return decade;
	}

	// "1980s", "1980's"
	const fullMatch = normalized.match(/(\d{4})(?:'?s)/);
	if (fullMatch) {
		const year = parseInt(fullMatch[1], 10);
		return year - (year % 10);
	}

	// "80s", "'80s", "80's", "80"
	const shortMatch = normalized.match(/'?(\d{2})(?:'?s)?/);
	if (shortMatch) {
		const n = parseInt(shortMatch[1], 10);
		return n < 30 ? 2000 + n : 1900 + n;
	}

	return null;
}

function cleanSongTitle(title: string): string {
	return title
		.replace(/\s+[-–—]\s+.*$/, '')
		.replace(/\s+\(.*$/, '')
		.replace(/\s+feat\.?\s.*$/i, '')
		.replace(/\s+ft\.?\s.*$/i, '')
		.trim();
}

function fuzzyMatch(guess: string, correct: string, threshold: number): boolean {
	const g = guess.toLowerCase().trim();
	const c = correct.toLowerCase().trim();
	if (c.length === 0) return false;

	const maxLen = Math.max(g.length, c.length);
	if (maxLen === 0) return false;

	const ratio = ((maxLen - distance(g, c)) / maxLen) * 100;
	return ratio >= threshold;
}

function checkYearMargin(playerAnswer: string, track: Track, margin: number): AnswerResult {
	const guess = parseYear(playerAnswer);
	const actual = track.releaseYear;
	const correctAnswer = String(actual);

	if (guess === null) return result(false, false, playerAnswer, correctAnswer);

	const diff = Math.abs(guess - actual);
	const correct = diff <= margin;
	const exactYear = guess === actual;

	return result(correct, exactYear, playerAnswer, correctAnswer);
}

export function checkAnswer(
	category: CategorySlug,
	playerAnswer: string,
	track: Track,
	fuzzyThreshold: number
): AnswerResult {
	const trimmed = playerAnswer.trim();
	if (trimmed === '') {
		const fallback = getFallbackCorrectAnswer(category, track);
		return result(false, false, trimmed, fallback);
	}

	switch (category) {
		case 'single-or-multiple': {
			const correctAnswer = track.multipleArtists ? 'Multiple' : 'Single';
			const normalized = trimmed.toLowerCase();
			const correct =
				(normalized === 'multiple' && track.multipleArtists) ||
				(normalized === 'single' && !track.multipleArtists);
			return result(correct, false, trimmed, correctAnswer);
		}

		case 'before-2000': {
			const before = track.releaseYear < 2000;
			const correctAnswer = before ? 'Yes' : 'No';
			const normalized = trimmed.toLowerCase();
			const correct = (normalized === 'yes' && before) || (normalized === 'no' && !before);
			return result(correct, false, trimmed, correctAnswer);
		}

		case '4-year-margin':
			return checkYearMargin(trimmed, track, 4);

		case '2-year-margin':
			return checkYearMargin(trimmed, track, 2);

		case '3-year-margin':
			return checkYearMargin(trimmed, track, 3);

		case 'exact-year': {
			const guess = parseYear(trimmed);
			const actual = track.releaseYear;
			const correct = guess === actual;
			return result(correct, correct, trimmed, String(actual));
		}

		case 'decade': {
			const decade = parseDecade(trimmed);
			const actual = track.releaseYear;
			const actualDecade = actual - (actual % 10);
			const correctAnswer = `${actualDecade}s`;

			if (decade === null) return result(false, false, trimmed, correctAnswer);
			return result(decade === actualDecade, false, trimmed, correctAnswer);
		}

		case 'song-title': {
			const cleaned = cleanSongTitle(track.name);
			const correct =
				fuzzyMatch(trimmed, cleaned, fuzzyThreshold) ||
				fuzzyMatch(trimmed, track.name, fuzzyThreshold);
			return result(correct, false, trimmed, cleaned);
		}

		case 'artist-name': {
			const primaryArtist = track.artists[0] ?? '';
			const correct = fuzzyMatch(trimmed, primaryArtist, fuzzyThreshold);
			return result(correct, false, trimmed, primaryArtist);
		}
	}
}

function getFallbackCorrectAnswer(category: CategorySlug, track: Track): string {
	switch (category) {
		case 'single-or-multiple':
			return track.multipleArtists ? 'Multiple' : 'Single';
		case 'before-2000':
			return track.releaseYear < 2000 ? 'Yes' : 'No';
		case '4-year-margin':
		case '2-year-margin':
		case '3-year-margin':
		case 'exact-year':
			return String(track.releaseYear);
		case 'decade':
			return `${track.releaseYear - (track.releaseYear % 10)}s`;
		case 'song-title':
			return cleanSongTitle(track.name);
		case 'artist-name':
			return track.artists[0] ?? '';
	}
}
