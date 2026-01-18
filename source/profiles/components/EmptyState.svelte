<script lang="ts">
	interface Props {
		icon?: string;
		title: string;
		description: string;
		buttonText?: string;
		onAction?: () => void;
	}

	const {
		icon = '📋',
		title,
		description,
		buttonText,
		onAction,
	}: Props = $props();
</script>

<div class="empty-state">
	<div class="empty-icon">{icon}</div>
	<h3>{title}</h3>
	<p>{description}</p>
	{#if buttonText && onAction}
		<button class="btn btn-primary" onclick={onAction}>
			{buttonText}
		</button>
	{/if}
</div>
