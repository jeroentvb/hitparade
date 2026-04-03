<script lang="ts">
	import { categoryColor } from './categoryColors';
	import type { CategorySlug } from '$lib/categories';

	let {
		categories,
		selectedCategory = null,
		spinning = false
	}: {
		categories: readonly { slug: CategorySlug; name: string }[];
		selectedCategory: { slug: CategorySlug; name: string } | null;
		spinning?: boolean;
	} = $props();

	const selectedIndex = $derived(
		selectedCategory ? categories.findIndex((c) => c.slug === selectedCategory.slug) : -1
	);

	const segmentAngle = $derived(categories.length > 0 ? 360 / categories.length : 0);

	// Rotate so the selected segment's center lands at the top (under the pointer).
	const targetRotation = $derived(
		selectedIndex >= 0 ? 360 * 5 - (selectedIndex * segmentAngle + segmentAngle / 2) : 0
	);

	// Build conic-gradient stops from category colors
	const conicGradient = $derived.by(() => {
		if (categories.length === 0) return '';
		const colorMap: Record<string, string> = {
			'bg-pink-600': '#db2777',
			'bg-amber-600': '#d97706',
			'bg-cyan-600': '#0891b2',
			'bg-lime-600': '#65a30d',
			'bg-violet-600': '#7c3aed'
		};
		const stops: string[] = [];
		categories.forEach((cat, i) => {
			const color = categoryColor(cat.slug);
			const hex = colorMap[color.bg] ?? '#475569';
			const startDeg = i * segmentAngle;
			const endDeg = (i + 1) * segmentAngle;
			stops.push(`${hex} ${startDeg}deg ${endDeg}deg`);
		});
		return `conic-gradient(from 0deg, ${stops.join(', ')})`;
	});

	// SVG arc paths for curved text — one arc per segment along the outer edge.
	// Each arc spans the segment's angular range at a fixed radius.
	const size = 300;
	const center = size / 2;
	const textRadius = center - 18;

	function arcPath(startDeg: number, endDeg: number): string {
		const startRad = ((startDeg - 90) * Math.PI) / 180;
		const endRad = ((endDeg - 90) * Math.PI) / 180;
		const x1 = center + textRadius * Math.cos(startRad);
		const y1 = center + textRadius * Math.sin(startRad);
		const x2 = center + textRadius * Math.cos(endRad);
		const y2 = center + textRadius * Math.sin(endRad);
		return `M ${x1} ${y1} A ${textRadius} ${textRadius} 0 0 1 ${x2} ${y2}`;
	}

	// Direct DOM manipulation for the spin animation — Svelte's $state batching
	// defeats the double-rAF trick needed for CSS transitions.
	let wheelEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!wheelEl) return;

		if (spinning) {
			wheelEl.style.transitionDuration = '0ms';
			wheelEl.style.transform = 'rotate(0deg)';

			const frame = requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					if (!wheelEl) return;
					wheelEl.style.transitionDuration = '3000ms';
					wheelEl.style.transform = `rotate(${targetRotation}deg)`;
				});
			});

			return () => cancelAnimationFrame(frame);
		}
	});
</script>

<div class="flex flex-col items-center gap-4">
	<!-- Pointer -->
	<div class="text-2xl">▼</div>

	<!-- Wheel -->
	<div class="relative h-[300px] w-[300px]">
		<div
			bind:this={wheelEl}
			class="absolute inset-0 transition-transform ease-[cubic-bezier(0.15,0.8,0.3,1)]"
		>
			<!-- Pie chart background (clipped to circle) -->
			<div
				class="h-full w-full overflow-hidden rounded-full border-4 border-slate-600"
				style="background: {conicGradient}"
			>
				<!-- Divider lines -->
				{#each categories as cat, i (cat.slug)}
					{@const angle = i * segmentAngle}
					<div
						class="absolute top-0 left-1/2 h-1/2 w-px origin-bottom bg-slate-900/40"
						style="transform: rotate({angle}deg)"
					></div>
				{/each}
			</div>

			<!-- Curved labels along the outer edge -->
			<svg
				class="pointer-events-none absolute inset-0"
				viewBox="0 0 {size} {size}"
				width={size}
				height={size}
			>
				<defs>
					{#each categories as cat, i (cat.slug)}
						{@const startDeg = i * segmentAngle}
						{@const endDeg = (i + 1) * segmentAngle}
						<path id="arc-{i}" d={arcPath(startDeg, endDeg)} fill="none" />
					{/each}
				</defs>
				{#each categories as cat, i (cat.slug)}
					<text font-size="12" font-weight="bold" fill="white" text-anchor="middle">
						<textPath href="#arc-{i}" startOffset="50%">{cat.name}</textPath>
					</text>
				{/each}
			</svg>
		</div>
	</div>

	<!-- Selected category label -->
	{#if selectedCategory && !spinning}
		<p class="text-lg font-bold text-white">{selectedCategory.name}</p>
	{:else if spinning}
		<p class="text-lg text-slate-400">Spinning...</p>
	{/if}
</div>
