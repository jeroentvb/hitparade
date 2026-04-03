<script lang="ts">
	let {
		correct,
		answer,
		correctAnswer
	}: { correct: boolean; answer: string; correctAnswer: string } = $props();
</script>

<div
	class="flex items-center gap-3 rounded-lg border px-4 py-3 {correct
		? 'border-green-700 bg-green-900/30'
		: 'border-red-700 bg-red-900/30'}"
>
	<span class="text-2xl">{correct ? '✓' : '✗'}</span>
	<div class="flex-1">
		{#if correct}
			<p class="text-sm font-medium text-green-400">Correct!</p>
			{#if answer}
				<p class="text-xs text-green-300/70">Your answer: {answer}</p>
			{/if}
		{:else}
			<p class="text-sm font-medium text-red-400">Wrong</p>
			{#if answer}
				<p class="text-xs text-red-300/70">Your answer: {answer}</p>
			{/if}
			<p class="text-xs text-slate-400">Correct: {correctAnswer}</p>
		{/if}
	</div>
</div>
