import type { Difficulty, Scorecard } from './types.js';

export const SIDE_A_CATEGORIES = [
	{ slug: 'single-or-multiple', name: 'Single or multiple artists' },
	{ slug: 'before-2000', name: 'Before 2000?' },
	{ slug: '4-year-margin', name: '4-year margin' },
	{ slug: 'decade', name: 'Decade' },
	{ slug: '2-year-margin', name: '2-year margin' }
] as const;

export const SIDE_B_CATEGORIES = [
	{ slug: 'song-title', name: 'Song title' },
	{ slug: 'exact-year', name: 'Exact year' },
	{ slug: 'artist-name', name: 'Artist/band name' },
	{ slug: 'decade', name: 'Decade' },
	{ slug: '3-year-margin', name: '3-year margin' }
] as const;

export type CategorySlug =
	| (typeof SIDE_A_CATEGORIES)[number]['slug']
	| (typeof SIDE_B_CATEGORIES)[number]['slug'];

const ALL_CATEGORIES = [...SIDE_A_CATEGORIES, ...SIDE_B_CATEGORIES];

export function categoryName(slug: CategorySlug): string {
	return ALL_CATEGORIES.find((c) => c.slug === slug)!.name;
}

/**
 * Randomly distribute 25 cells across `count` categories, each appearing 3-5 times.
 * Starts with an even split (5 each) and randomly transfers between categories.
 */
function generateDistribution(count: number): number[] {
	const dist = new Array(count).fill(5);

	for (let i = 0; i < 10; i++) {
		const from = Math.floor(Math.random() * count);
		const to = Math.floor(Math.random() * count);
		if (from !== to && dist[from] > 3 && dist[to] < 5) {
			dist[from]--;
			dist[to]++;
		}
	}

	return dist;
}

/** Fisher-Yates shuffle — randomizes array in place. */
function shuffle<T>(array: T[]): T[] {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

/** Generate a randomized 5×5 bingo scorecard for the given difficulty side. */
export function generateScorecard(difficulty: Difficulty): Scorecard {
	const categories = difficulty === 'A' ? SIDE_A_CATEGORIES : SIDE_B_CATEGORIES;
	const distribution = generateDistribution(categories.length);

	const cells: CategorySlug[] = [];
	for (let i = 0; i < categories.length; i++) {
		for (let j = 0; j < distribution[i]; j++) {
			cells.push(categories[i].slug);
		}
	}

	shuffle(cells);

	return cells.map((category) => ({ category, marked: false }));
}
