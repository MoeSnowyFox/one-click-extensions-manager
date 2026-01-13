import type { ExtensionInfo } from './types';
import optionsStorage, { getPinnedExtensions } from '../options-storage';
import { setExtensionEnabledSafe } from './management';

/**
 * Check if an extension can actually be modified by attempting to set its current state
 * This catches cases where mayDisable is true but the extension still can't be modified
 * (e.g., "This extension is no longer supported and has been disabled")
 * @param extension - The extension to check
 * @returns Promise resolving to true if the extension can be modified
 */
async function checkCanModify(extension: chrome.management.ExtensionInfo): Promise<boolean> {
	// First check Chrome's built-in property
	if (!extension.mayDisable) {
		return false;
	}

	// Some extensions report mayDisable=true but still can't be toggled (policy/deprecated/etc.)
	return setExtensionEnabledSafe(extension.id, extension.enabled, { swallow: true });
}

/**
 * Enhances the raw Chrome extension info with additional properties
 * @param extension - The raw Chrome extension info
 * @param isPinned - Whether the extension is pinned by user
 * @param canModify - Whether the extension can actually be modified
 * @returns Enhanced extension info with additional properties
 */
function enhanceExtensionInfo(
	extension: chrome.management.ExtensionInfo,
	isPinned: boolean = false,
	canModify: boolean = true,
): ExtensionInfo {
	return {
		...extension,
		shown: true,
		indexedName: extension.name.toLowerCase(),
		isPinned,
		mayDisable: canModify,
	};
}

/**
 * Sorts extensions by pinned status, enabled status, and name
 * @param extensions - Array of extensions to sort
 * @param pinnedExtensions - Array of pinned extension IDs
 * @returns Sorted array of extensions
 */
export function sortExtensions<T extends chrome.management.ExtensionInfo>(
	extensions: T[],
	pinnedExtensions: string[],
): T[] {
	return [...extensions].sort((a, b) => {
		const aPinned = pinnedExtensions.includes(a.id);
		const bPinned = pinnedExtensions.includes(b.id);

		// First sort by pinned status
		if (aPinned !== bPinned) {
			return bPinned ? 1 : -1; // Pinned extensions first
		}

		// If both are pinned or both are not pinned, sort by enabled status
		if (a.enabled === b.enabled) {
			return a.name.localeCompare(b.name); // Sort by name
		}

		return a.enabled < b.enabled ? 1 : -1; // Enabled extensions first
	});
}

/**
 * Prepares the extension list by filtering, enhancing, and sorting
 * @param extensions - Raw Chrome extension info array
 * @returns Promise resolving to enhanced and sorted extension info array
 */
export default async function prepareExtensionList(extensions: chrome.management.ExtensionInfo[]): Promise<ExtensionInfo[]> {
	const options = await optionsStorage.getAll();
	const pinnedExtensions = getPinnedExtensions(options);

	// Filter out non-extensions and self
	const filteredExtensions = extensions.filter(
		({ type, id }) => type === 'extension' && id !== chrome.runtime.id,
	);

	// Sort extensions
	const sortedExtensions = sortExtensions(filteredExtensions, pinnedExtensions);

	// Check which extensions can actually be modified (in parallel)
	const canModifyResults = await Promise.all(
		sortedExtensions.map(ext => checkCanModify(ext)),
	);

	// Enhance with additional properties
	return sortedExtensions.map((extension, index) =>
		enhanceExtensionInfo(
			extension,
			pinnedExtensions.includes(extension.id),
			canModifyResults[index],
		),
	);
}
