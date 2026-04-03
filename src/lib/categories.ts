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

export function categoriesForDifficulty(difficulty: string) {
	return difficulty === 'A' ? SIDE_A_CATEGORIES : SIDE_B_CATEGORIES;
}
