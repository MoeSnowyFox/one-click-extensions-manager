<script lang="ts">
	interface NavItem {
		id: string;
		icon: string;
		label: string;
		badge?: number | string;
		disabled?: boolean;
	}

	interface Props {
		items: NavItem[];
		activeId: string | null;
		sectionTitle?: string;
		onSelect: (id: string) => void;
	}

	let {items, activeId, sectionTitle, onSelect}: Props = $props();
</script>

{#if sectionTitle}
	<div class="nav-section-title">{sectionTitle}</div>
{/if}

{#each items as item (item.id)}
	<button
		class="nav-item"
		class:active={activeId === item.id}
		class:disabled={item.disabled}
		onclick={() => onSelect(item.id)}
		disabled={item.disabled}
	>
		<span class="nav-icon">{item.icon}</span>
		<span class="nav-text">{item.label}</span>
		{#if item.badge !== undefined}
			<span class="badge">{item.badge}</span>
		{/if}
	</button>
{/each}
