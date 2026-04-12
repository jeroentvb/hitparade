<script lang="ts">
	import { Button } from 'flowbite-svelte';

	let {
		category,
		onsubmit,
		disabled = false,
		value = $bindable('')
	}: {
		category: { slug: string; name: string };
		onsubmit: (answer: string) => void;
		disabled?: boolean;
		value?: string;
	} = $props();

	const isChoice = $derived(
		category.slug === 'single-or-multiple' || category.slug === 'before-2000'
	);

	const isNumeric = $derived(
		category.slug === 'exact-year' ||
			category.slug === '2-year-margin' ||
			category.slug === '3-year-margin' ||
			category.slug === '4-year-margin' ||
			category.slug === 'decade'
	);

	const placeholder = $derived(
		(() => {
			switch (category.slug) {
				case 'exact-year':
				case '2-year-margin':
				case '3-year-margin':
				case '4-year-margin':
					return 'Enter a year...';
				case 'decade':
					return 'Enter a decade (e.g. 80s)...';
				case 'song-title':
					return 'Enter the song title...';
				case 'artist-name':
					return 'Enter the artist name...';
				default:
					return 'Your answer...';
			}
		})()
	);

	function handleTextSubmit() {
		if (disabled || !value.trim()) return;
		onsubmit(value.trim());
	}

	function handleChoice(value: string) {
		if (disabled) return;
		onsubmit(value);
	}
</script>

{#if isChoice}
	<!-- Choice buttons -->
	<div class="flex gap-3">
		{#if category.slug === 'single-or-multiple'}
			<Button
				color="purple"
				outline
				size="lg"
				class="flex-1"
				{disabled}
				onclick={() => handleChoice('Single')}
			>
				Single
			</Button>
			<Button
				color="purple"
				outline
				size="lg"
				class="flex-1"
				{disabled}
				onclick={() => handleChoice('Multiple')}
			>
				Multiple
			</Button>
		{:else}
			<Button
				color="purple"
				outline
				size="lg"
				class="flex-1"
				{disabled}
				onclick={() => handleChoice('Yes')}
			>
				Yes
			</Button>
			<Button
				color="purple"
				outline
				size="lg"
				class="flex-1"
				{disabled}
				onclick={() => handleChoice('No')}
			>
				No
			</Button>
		{/if}
	</div>
{:else}
	<!-- Text input -->
	<form onsubmit={handleTextSubmit} class="flex gap-2">
		<input
			type="text"
			inputmode={isNumeric ? 'numeric' : 'text'}
			bind:value
			{placeholder}
			{disabled}
			class="flex-1 rounded-lg border-slate-600 bg-slate-800 text-white placeholder-slate-500 focus:border-purple-500 focus:ring-purple-500"
		/>
		<Button color="purple" type="submit" disabled={disabled || !value.trim()}>Submit</Button>
	</form>
{/if}
