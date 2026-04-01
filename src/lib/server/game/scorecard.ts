import type { Difficulty, Scorecard } from './types.js';

export const SIDE_A_CATEGORIES = [
	'Group or solo',
	'Before 2000?',
	'4-year margin',
	'Decade',
	'2-year margin'
] as const;

export const SIDE_B_CATEGORIES = [
	'Song title',
	'Exact year',
	'Artist/band name',
	'Decade',
	'3-year margin'
] as const;

export type CategoryName = (typeof SIDE_A_CATEGORIES)[number] | (typeof SIDE_B_CATEGORIES)[number];

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

	const cells: string[] = [];
	for (let i = 0; i < categories.length; i++) {
		for (let j = 0; j < distribution[i]; j++) {
			cells.push(categories[i]);
		}
	}

	shuffle(cells);

	return cells.map((category) => ({ category, marked: false }));
}
