<script lang="ts">
	interface ToastItem {
		id: number;
		type: 'success' | 'error';
		message: string;
		closing?: boolean;
	}

	let toasts = $state<ToastItem[]>([]);
	let nextId = 0;

	export function showToast(
		type: 'success' | 'error',
		message: string,
		duration = 3000,
	) {
		const id = nextId++;
		toasts = [...toasts, {id, type, message}];

		setTimeout(() => {
			closeToast(id);
		}, duration);
	}

	function closeToast(id: number) {
		const toast = toasts.find(t => t.id === id);
		if (toast) {
			toast.closing = true;
			toasts = [...toasts];
			setTimeout(() => {
				toasts = toasts.filter(t => t.id !== id);
			}, 300);
		}
	}
</script>

{#if toasts.length > 0}
	<div class="toast-container">
		{#each toasts as toast (toast.id)}
			<div class="toast toast-{toast.type}" class:toast-out={toast.closing}>
				<span class="toast-icon">
					{toast.type === 'success' ? '✓' : '✕'}
				</span>
				<span class="toast-message">{toast.message}</span>
			</div>
		{/each}
	</div>
{/if}
