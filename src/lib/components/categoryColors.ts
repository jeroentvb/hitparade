/** Category color mapping — consistent across Scorecard and DiscoSpinner. */
import type { CategorySlug } from '$lib/categories';

const CATEGORY_COLORS: Record<
	CategorySlug,
	{ bg: string; text: string; border: string; glow: string }
> = {
	'single-or-multiple': {
		bg: 'bg-pink-600',
		text: 'text-pink-200',
		border: 'border-pink-500',
		glow: 'ring-pink-500/50'
	},
	'before-2000': {
		bg: 'bg-amber-600',
		text: 'text-amber-200',
		border: 'border-amber-500',
		glow: 'ring-amber-500/50'
	},
	'4-year-margin': {
		bg: 'bg-cyan-600',
		text: 'text-cyan-200',
		border: 'border-cyan-500',
		glow: 'ring-cyan-500/50'
	},
	decade: {
		bg: 'bg-lime-600',
		text: 'text-lime-200',
		border: 'border-lime-500',
		glow: 'ring-lime-500/50'
	},
	'2-year-margin': {
		bg: 'bg-violet-600',
		text: 'text-violet-200',
		border: 'border-violet-500',
		glow: 'ring-violet-500/50'
	},
	'song-title': {
		bg: 'bg-pink-600',
		text: 'text-pink-200',
		border: 'border-pink-500',
		glow: 'ring-pink-500/50'
	},
	'exact-year': {
		bg: 'bg-amber-600',
		text: 'text-amber-200',
		border: 'border-amber-500',
		glow: 'ring-amber-500/50'
	},
	'artist-name': {
		bg: 'bg-cyan-600',
		text: 'text-cyan-200',
		border: 'border-cyan-500',
		glow: 'ring-cyan-500/50'
	},
	'3-year-margin': {
		bg: 'bg-violet-600',
		text: 'text-violet-200',
		border: 'border-violet-500',
		glow: 'ring-violet-500/50'
	}
};

const FALLBACK = {
	bg: 'bg-slate-600',
	text: 'text-slate-200',
	border: 'border-slate-500',
	glow: 'ring-slate-500/50'
};

export function categoryColor(slug: CategorySlug) {
	return CATEGORY_COLORS[slug] ?? FALLBACK;
}
