<script lang="ts">
	import { Button, Spinner } from 'flowbite-svelte';

	interface Props {
		devices: Array<{ id: string; name: string }>;
		selectedDeviceId: string;
		loading: boolean;
		disabled?: boolean;
		onSelect: (deviceId: string) => void;
		onRefresh: () => void;
	}

	let {
		devices,
		selectedDeviceId,
		loading,
		disabled = false,
		onSelect,
		onRefresh
	}: Props = $props();

	function handleChange(event: Event) {
		onSelect((event.target as HTMLSelectElement).value);
	}
</script>

{#if loading}
	<div class="flex items-center gap-2 text-slate-400">
		<Spinner size="4" />
		<span class="text-sm">Loading devices...</span>
	</div>
{:else if devices.length === 0}
	<p class="text-sm text-slate-400">No devices found.</p>
	<Button color="alternative" size="xs" class="mt-2" onclick={onRefresh}>Refresh</Button>
{:else}
	<select
		class="w-full rounded-lg border-slate-600 bg-slate-800 text-sm text-white focus:border-purple-500 focus:ring-purple-500"
		value={selectedDeviceId}
		{disabled}
		onchange={handleChange}
	>
		<option value="">Select a device...</option>
		{#each devices as device (device.id)}
			<option value={device.id}>{device.name}</option>
		{/each}
	</select>
	<Button color="alternative" size="xs" class="mt-2" {disabled} onclick={onRefresh}>Refresh</Button>
{/if}
