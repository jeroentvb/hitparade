<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import Scorecard from '$lib/components/Scorecard.svelte';
	import { SIDE_A_CATEGORIES, SIDE_B_CATEGORIES, type CategorySlug } from '$lib/categories';
	import { categoryColor } from '$lib/components/categoryColors';

	const exampleCells: { category: CategorySlug; marked: boolean }[] = [
		{ category: 'decade', marked: true },
		{ category: 'single-or-multiple', marked: false },
		{ category: '4-year-margin', marked: true },
		{ category: 'before-2000', marked: false },
		{ category: '2-year-margin', marked: false },
		{ category: 'before-2000', marked: false },
		{ category: '2-year-margin', marked: true },
		{ category: 'decade', marked: false },
		{ category: 'single-or-multiple', marked: false },
		{ category: '4-year-margin', marked: false },
		{ category: '4-year-margin', marked: false },
		{ category: 'decade', marked: false },
		{ category: 'single-or-multiple', marked: true },
		{ category: '2-year-margin', marked: false },
		{ category: 'before-2000', marked: false },
		{ category: 'single-or-multiple', marked: false },
		{ category: '4-year-margin', marked: false },
		{ category: 'before-2000', marked: false },
		{ category: '2-year-margin', marked: false },
		{ category: 'decade', marked: false },
		{ category: '2-year-margin', marked: false },
		{ category: 'before-2000', marked: false },
		{ category: 'decade', marked: false },
		{ category: '4-year-margin', marked: false },
		{ category: 'single-or-multiple', marked: false }
	];
</script>

<svelte:head>
	<title>Rules — Hitparade</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center px-4 py-10">
	<div class="w-full max-w-lg space-y-8">
		<h1
			class="bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300 bg-clip-text text-center text-4xl font-extrabold tracking-tight text-transparent"
		>
			How to Play
		</h1>

		<ol class="list-inside list-decimal space-y-2 text-slate-300">
			<li>The host picks a Spotify playlist and starts the game. Players join with a code.</li>
			<li>Each player gets a unique 5&times;5 bingo card with colored category squares.</li>
			<li>
				A song plays and a category is spun &mdash; everyone guesses based on that category. For
				example, you might need to guess the decade, the exact year, or whether it was released
				before 2000. You have a limited time to submit your answer.
			</li>
			<li>
				Guess right and you get to place a cross on one of your card's matching category squares.
				Get 5 crosses in a row &mdash; horizontally, vertically, or diagonally &mdash; and you win!
			</li>
		</ol>

		<div class="space-y-2">
			<h2 class="text-center text-lg font-semibold text-slate-200">Example card (Side A)</h2>
			<Scorecard cells={exampleCells} categories={SIDE_A_CATEGORIES} />
		</div>

		<div class="space-y-3">
			<h2 class="text-center text-lg font-semibold text-slate-200">Difficulty sides</h2>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<h3 class="mb-2 text-sm font-semibold text-purple-300">Side A &mdash; Easier</h3>
					<ul class="space-y-1 text-sm text-slate-300">
						{#each SIDE_A_CATEGORIES as cat (cat.slug)}
							{@const color = categoryColor(cat.slug as CategorySlug)}
							<li class="flex items-center gap-1.5">
								<span class="inline-block h-2.5 w-2.5 rounded {color.bg}"></span>
								{cat.name}
							</li>
						{/each}
					</ul>
				</div>
				<div>
					<h3 class="mb-2 text-sm font-semibold text-purple-300">Side B &mdash; Expert</h3>
					<ul class="space-y-1 text-sm text-slate-300">
						{#each SIDE_B_CATEGORIES as cat (cat.slug)}
							{@const color = categoryColor(cat.slug as CategorySlug)}
							<li class="flex items-center gap-1.5">
								<span class="inline-block h-2.5 w-2.5 rounded {color.bg}"></span>
								{cat.name}
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>

		<div class="text-center">
			<Button href="/" outline color="purple">Back to home</Button>
		</div>
	</div>
</main>
