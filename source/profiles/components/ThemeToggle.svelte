<script lang="ts">
	const getI18N = chrome.i18n.getMessage;

	interface Props {
		darkMode: boolean;
		onchange?: (value: boolean) => void;
	}

	let {darkMode = $bindable(), onchange}: Props = $props();

	function toggleTheme() {
		darkMode = !darkMode;
		onchange?.(darkMode);
	}
</script>

<button
	class="theme-toggle-btn"
	onclick={toggleTheme}
	aria-label={darkMode
		? getI18N('lightMode') || 'Light mode'
		: getI18N('darkMode') || 'Dark mode'}
	title={darkMode
		? getI18N('lightMode') || 'Light mode'
		: getI18N('darkMode') || 'Dark mode'}
>
	{darkMode ? '☀️' : '🌙'}
</button>

<style>
	.theme-toggle-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: var(--surface);
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.2s,
			transform 0.2s;
	}

	.theme-toggle-btn:hover {
		background: var(--border);
		transform: scale(1.1);
	}

	.theme-toggle-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
</style>
