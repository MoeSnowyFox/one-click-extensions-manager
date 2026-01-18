<script lang="ts">
	import {createEventDispatcher} from 'svelte';

	interface Props {
		show: boolean;
		title: string;
		children?: import('svelte').Snippet;
		footer?: import('svelte').Snippet;
	}

	let {show = $bindable(), title, children, footer}: Props = $props();
	const dispatch = createEventDispatcher();
	let closing = $state(false);

	function close() {
		closing = true;
		setTimeout(() => {
			show = false;
			closing = false;
			dispatch('close');
		}, 200);
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			close();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={handleOverlayClick}>
		<div class="modal" class:modal-closing={closing}>
			<div class="modal-header">
				<h2 class="modal-title">{title}</h2>
			</div>
			<div class="modal-body">
				{@render children?.()}
			</div>
			{#if footer}
				<div class="modal-footer">
					{@render footer?.()}
				</div>
			{/if}
		</div>
	</div>
{/if}
