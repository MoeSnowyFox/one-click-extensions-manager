<script lang="ts">
import type {
ExtensionStateConfig,
ExtensionTargetState,
MatchCondition,
MatchType,
ProfileGroup,
StoredOptions,
} from '../lib/types';
import {onMount} from 'svelte';
import pickBestIcon from '../lib/icons';
import {
createMatchCondition,
createProfileGroup,
validatePattern,
} from '../lib/url-matcher';
import optionsStorage, {
addProfileGroup,
deleteProfileGroup,
getProfileGroups,
updateProfileGroup,
getDefaultProfileGroup,
setDefaultProfileGroup,
matchOptions,
} from '../options-storage';

import ThemeToggle from './components/ThemeToggle.svelte';
import Modal from './components/Modal.svelte';
import EmptyState from './components/EmptyState.svelte';

const GITHUB_URL = 'https://github.com/MoeSnowyFox/one-click-extensions-manager';

interface IconInfo {
size: number;
url: string;
}

interface ExtensionWithState {
id: string;
name: string;
icons?: IconInfo[];
targetState: ExtensionTargetState;
}

type ViewMode = 'settings-ui' | 'settings-general' | 'profile-default' | 'profile-custom';

const getI18N = chrome.i18n.getMessage;

let profiles = $state<ProfileGroup[]>([]);
let defaultProfile = $state<ProfileGroup | null>(null);
let extensions = $state<chrome.management.ExtensionInfo[]>([]);
let darkMode = $state(false);

let optionPosition = $state<StoredOptions['position']>('popup');
let optionShowButtons = $state<StoredOptions['showButtons']>('on-demand');
let savingOptionKey = $state<string | null>(null);

let currentView = $state<ViewMode>('profile-default');
let selectedProfileId = $state<string | null>(null);

// Inline editing states for default profile
let defaultExtensionStates = $state<ExtensionWithState[]>([]);

// Inline editing states for custom profiles
let editingConditions = $state<MatchCondition[]>([]);
let editingExtensionStates = $state<ExtensionWithState[]>([]);
let editingName = $state('');
let editingPriority = $state(0);
let validationErrors = $state<Record<string, string>>({});

let showNewProfileModal = $state(false);
let newProfileName = $state('');

let selectedProfile = $derived(
profiles.find(p => p.id === selectedProfileId) ?? null,
);

function applyTheme(value: boolean): void {
darkMode = value;
document.documentElement.dataset.theme = value ? 'dark' : 'light';
}

function initDarkMode(): void {
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
applyTheme(prefersDark.matches);
prefersDark.addEventListener('change', e => applyTheme(e.matches));
}

async function loadData(): Promise<void> {
const options = await optionsStorage.getAll();
profiles = getProfileGroups(options);
defaultProfile = getDefaultProfileGroup(options);
optionPosition = options.position;
optionShowButtons = options.showButtons;

const allExtensions = await chrome.management.getAll();
extensions = allExtensions.filter(
ext => ext.type === 'extension' && ext.id !== chrome.runtime.id,
);

// Auto-initialize default profile if empty
if (!defaultProfile || defaultProfile.extensionStates.length === 0) {
await initializeDefaultProfile();
}

// Initialize inline editing states
initDefaultExtensionStates();
}

async function initializeDefaultProfile(): Promise<void> {
const allExtensions = await chrome.management.getAll();
const extensionStates: ExtensionStateConfig[] = allExtensions
.filter(ext => ext.type === 'extension' && ext.id !== chrome.runtime.id)
.map(ext => ({
extensionId: ext.id,
targetState: ext.enabled ? 'enable' : 'disable' as ExtensionTargetState,
}));

const newDefault: ProfileGroup = {
id: 'default',
name: getI18N('defaultProfile') || 'Default Profile',
enabled: true,
priority: -1,
conditions: [],
extensionStates,
isDefault: true,
createdAt: Date.now(),
updatedAt: Date.now(),
};
await setDefaultProfileGroup(newDefault);
defaultProfile = newDefault;
}

function initDefaultExtensionStates(): void {
const stateMap = defaultProfile
? new Map(defaultProfile.extensionStates.map(s => [s.extensionId, s.targetState]))
: new Map<string, ExtensionTargetState>();
defaultExtensionStates = extensions.map(ext => ({
id: ext.id,
name: ext.name,
icons: ext.icons,
targetState: stateMap.get(ext.id) ?? 'keep',
}));
}

function initCustomProfileEditing(profile: ProfileGroup): void {
editingName = profile.name;
editingPriority = profile.priority;
editingConditions = [...profile.conditions];
const stateMap = new Map(profile.extensionStates.map(s => [s.extensionId, s.targetState]));
editingExtensionStates = extensions.map(ext => ({
id: ext.id,
name: ext.name,
icons: ext.icons,
targetState: stateMap.get(ext.id) ?? 'keep',
}));
validationErrors = {};
}

onMount(() => {
initDarkMode();
loadData();
});

async function handleOptionChange<K extends keyof Pick<StoredOptions, 'position' | 'showButtons'>>(
key: K, value: StoredOptions[K]
): Promise<void> {
savingOptionKey = key;
await optionsStorage.set({[key]: value});
if (key === 'position') await matchOptions();
savingOptionKey = null;
}

function navigateTo(view: ViewMode, profileId?: string): void {
currentView = view;
if (profileId) {
selectedProfileId = profileId;
const profile = profiles.find(p => p.id === profileId);
if (profile) initCustomProfileEditing(profile);
}
}

function openGitHub(): void {
window.open(GITHUB_URL, '_blank');
}

function openNewProfileModal(): void {
newProfileName = '';
showNewProfileModal = true;
}

async function createNewProfile(): Promise<void> {
if (!newProfileName.trim()) return;
const newProfile = createProfileGroup(newProfileName.trim(), profiles.length);
await addProfileGroup(newProfile);
await loadData();
showNewProfileModal = false;
selectedProfileId = newProfile.id;
initCustomProfileEditing(newProfile);
currentView = 'profile-custom';
}

// Default profile inline editing
function updateDefaultExtensionState(extId: string, state: ExtensionTargetState): void {
const ext = defaultExtensionStates.find(e => e.id === extId);
if (ext) ext.targetState = state;
}

async function saveDefaultProfile(): Promise<void> {
const extensionStates: ExtensionStateConfig[] = defaultExtensionStates
.filter(e => e.targetState !== 'keep')
.map(e => ({extensionId: e.id, targetState: e.targetState}));

const defaultProfileData: ProfileGroup = {
id: 'default',
name: getI18N('defaultProfile') || 'Default Profile',
enabled: true,
priority: -1,
conditions: [],
extensionStates,
isDefault: true,
createdAt: defaultProfile?.createdAt ?? Date.now(),
updatedAt: Date.now(),
};
await setDefaultProfileGroup(defaultProfileData);
defaultProfile = defaultProfileData;
}

// Custom profile inline editing
function addCondition(): void {
editingConditions = [...editingConditions, createMatchCondition('host-wildcard', '')];
}

function removeCondition(index: number): void {
editingConditions = editingConditions.filter((_, i) => i !== index);
}

function updateConditionType(index: number, type: MatchType): void {
editingConditions[index] = {...editingConditions[index], type};
}

function updateConditionPattern(index: number, pattern: string): void {
editingConditions[index] = {...editingConditions[index], pattern};
delete validationErrors[`condition-${index}`];
}

function updateExtensionState(extId: string, state: ExtensionTargetState): void {
const ext = editingExtensionStates.find(e => e.id === extId);
if (ext) ext.targetState = state;
}

function validateCustomProfile(): boolean {
validationErrors = {};
if (!editingName.trim()) {
validationErrors.name = getI18N('profileNameRequired') || 'Profile name is required';
}
if (editingConditions.length === 0) {
validationErrors.conditions = getI18N('atLeastOneCondition') || 'At least one condition is required';
}
editingConditions.forEach((condition, index) => {
const error = validatePattern(condition.pattern, condition.type);
if (error) validationErrors[`condition-${index}`] = error;
});
return Object.keys(validationErrors).length === 0;
}

async function saveCustomProfile(): Promise<void> {
if (!validateCustomProfile() || !selectedProfile) return;

const extensionStates: ExtensionStateConfig[] = editingExtensionStates
.filter(e => e.targetState !== 'keep')
.map(e => ({extensionId: e.id, targetState: e.targetState}));

const updated: ProfileGroup = {
...selectedProfile,
name: editingName.trim(),
priority: editingPriority,
conditions: editingConditions,
extensionStates,
updatedAt: Date.now(),
};
await updateProfileGroup(updated);
await loadData();
}

async function handleDeleteProfile(profileId: string): Promise<void> {
if (confirm(getI18N('confirmDeleteProfile') || 'Are you sure you want to delete this profile?')) {
await deleteProfileGroup(profileId);
if (selectedProfileId === profileId) {
selectedProfileId = null;
currentView = 'profile-default';
}
await loadData();
}
}

async function handleToggleProfile(profile: ProfileGroup): Promise<void> {
profile.enabled = !profile.enabled;
await updateProfileGroup(profile);
await loadData();
}

function getMatchTypeLabel(type: MatchType): string {
const labels: Record<MatchType, string> = {
'host-wildcard': getI18N('hostWildcard') || 'Host Wildcard',
'url-wildcard': getI18N('urlWildcard') || 'URL Wildcard',
regex: getI18N('regex') || 'Regex',
};
return labels[type] || type;
}

function getProfileColors(index: number): string {
const colors = ['#4285f4', '#34a853', '#fbbc04', '#ea4335', '#9c27b0'];
return colors[index % colors.length];
}
</script>

<div class="app-container">
<!-- Sidebar -->
<aside class="sidebar">
<div class="sidebar-header">
<button class="app-header-btn" onclick={openGitHub} title={getI18N('extName') || 'One Click Extensions Manager'}>
<img src="../logo.png" alt="Logo" class="app-logo" />
<h1 class="app-title">{getI18N('extName') || 'One Click Extensions Manager'}</h1>
</button>
</div>

<nav class="sidebar-nav">
<div class="nav-section-title">{getI18N('settings') || 'Settings'}</div>

<button class="nav-item" class:active={currentView === 'settings-ui'}
onclick={() => navigateTo('settings-ui')}>
<span class="nav-icon"></span>
<span class="nav-text">{getI18N('settingsUI') || 'Interface'}</span>
</button>

<button class="nav-item" class:active={currentView === 'settings-general'}
onclick={() => navigateTo('settings-general')}>
<span class="nav-icon"></span>
<span class="nav-text">{getI18N('settingsGeneral') || 'General'}</span>
</button>

<div class="nav-section-title">{getI18N('profileGroups') || 'Profile Groups'}</div>

<button class="nav-item" class:active={currentView === 'profile-default'}
onclick={() => navigateTo('profile-default')}>
<span class="nav-icon"></span>
<span class="nav-text">{getI18N('defaultProfile') || 'Default'}</span>
{#if defaultProfile}
<span class="badge">{defaultProfile.extensionStates.length}</span>
{/if}
</button>

{#each profiles as profile, index (profile.id)}
<button class="nav-item" class:active={selectedProfileId === profile.id && currentView === 'profile-custom'}
class:disabled={!profile.enabled} onclick={() => navigateTo('profile-custom', profile.id)}>
<span class="nav-icon" style="color: {getProfileColors(index)}"></span>
<span class="nav-text">{profile.name}</span>
<span class="badge">{profile.enabled ? profile.conditions.length : (getI18N('disabled') || 'Disabled')}</span>
</button>
{/each}

<button class="nav-add-btn" onclick={openNewProfileModal}>
+ {getI18N('addProfile') || 'New Profile'}
</button>
</nav>

<div class="sidebar-footer">
<ThemeToggle bind:darkMode onchange={val => applyTheme(val)} />
</div>
</aside>

<!-- Main Content -->
<main class="main-content">
<header class="content-header">
<div class="header-breadcrumb">
{#if currentView.startsWith('settings')}
<span class="breadcrumb-item">{getI18N('settings') || 'Settings'}</span>
<span class="breadcrumb-separator"></span>
<span class="breadcrumb-current">
{currentView === 'settings-ui' ? (getI18N('settingsUI') || 'Interface') : (getI18N('settingsGeneral') || 'General')}
</span>
{:else if currentView === 'profile-default'}
<span class="breadcrumb-item">{getI18N('profileGroups') || 'Profile Groups'}</span>
<span class="breadcrumb-separator"></span>
<span class="breadcrumb-current">{getI18N('defaultProfile') || 'Default'}</span>
{:else if currentView === 'profile-custom' && selectedProfile}
<span class="breadcrumb-item">{getI18N('profileGroups') || 'Profile Groups'}</span>
<span class="breadcrumb-separator"></span>
<span class="breadcrumb-current">{selectedProfile.name}</span>
{/if}
</div>
<div class="header-actions">
{#if currentView === 'profile-default'}
<button class="btn btn-primary" onclick={saveDefaultProfile}>{getI18N('save') || 'Save'}</button>
{:else if currentView === 'profile-custom' && selectedProfile}
<label class="toggle-switch">
<input type="checkbox" checked={selectedProfile.enabled} onchange={() => handleToggleProfile(selectedProfile)} />
<span class="slider"></span>
</label>
<button class="btn btn-primary" onclick={saveCustomProfile}>{getI18N('save') || 'Save'}</button>
<button class="btn btn-danger" onclick={() => handleDeleteProfile(selectedProfile.id)}>{getI18N('delete') || 'Delete'}</button>
{/if}
</div>
</header>

<div class="content-body">
{#if currentView === 'settings-ui'}
<div class="page-header">
<h2 class="page-title">{getI18N('settingsUI') || 'Interface Settings'}</h2>
<p class="page-description">{getI18N('settingsUIDescription') || 'Customize how the extension manager looks.'}</p>
</div>
<div class="card">
<h3 class="card-title">{getI18N('displayOptions') || 'Display Options'}</h3>
<div class="form-group">
<label class="form-label" for="showButtons">{getI18N('showButtons') || 'Show Buttons'}</label>
<select id="showButtons" class="select" value={optionShowButtons}
onchange={e => handleOptionChange('showButtons', (e.target as HTMLSelectElement).value as StoredOptions['showButtons'])}
disabled={savingOptionKey === 'showButtons'}>
<option value="on-demand">{getI18N('onRightClick') || 'On right-click (default)'}</option>
<option value="always">{getI18N('always') || 'Always'}</option>
</select>
</div>
</div>

{:else if currentView === 'settings-general'}
<div class="page-header">
<h2 class="page-title">{getI18N('settingsGeneral') || 'General Settings'}</h2>
<p class="page-description">{getI18N('settingsGeneralDescription') || 'Configure popup behavior and layout.'}</p>
</div>
<div class="card">
<h3 class="card-title">{getI18N('popupBehavior') || 'Popup Behavior'}</h3>
<div class="form-group">
<label class="form-label" for="position">{getI18N('position') || 'Position'}</label>
<select id="position" class="select" value={optionPosition}
onchange={e => handleOptionChange('position', (e.target as HTMLSelectElement).value as StoredOptions['position'])}
disabled={savingOptionKey === 'position'}>
<option value="popup">{getI18N('popupMenu') || 'Popup (default)'}</option>
<option value="window">{getI18N('popupWindow') || 'Window'}</option>
<option value="tab">{getI18N('tab') || 'Tab'}</option>
<option value="sidebar">{getI18N('sidebar') || 'Sidebar'}</option>
</select>
</div>
</div>

{:else if currentView === 'profile-default'}
<div class="page-header">
<h2 class="page-title">{getI18N('defaultProfile') || 'Default Profile'}</h2>
<p class="page-description">{getI18N('defaultProfileDescription') || 'The default profile applies when no other profile matches.'}</p>
</div>
<div class="card">
<h3 class="card-title">{getI18N('extensionStates') || 'Extension States'}</h3>
<p class="card-description">{getI18N('defaultExtensionStatesHelp') || 'Set the default state for extensions when no other profile matches.'}</p>
<div class="extension-states">
{#each defaultExtensionStates as ext (ext.id)}
<div class="extension-state-item">
<img src={pickBestIcon(ext.icons, 24)} alt="" class="ext-icon" />
<span class="ext-name">{ext.name}</span>
<div class="state-selector">
<button class="state-btn" class:active={ext.targetState === 'keep'}
onclick={() => updateDefaultExtensionState(ext.id, 'keep')} title={getI18N('keepState') || 'Keep'}></button>
<button class="state-btn enable" class:active={ext.targetState === 'enable'}
onclick={() => updateDefaultExtensionState(ext.id, 'enable')} title={getI18N('enable') || 'Enable'}></button>
<button class="state-btn disable" class:active={ext.targetState === 'disable'}
onclick={() => updateDefaultExtensionState(ext.id, 'disable')} title={getI18N('disable') || 'Disable'}></button>
</div>
</div>
{/each}
</div>
</div>

{:else if currentView === 'profile-custom' && selectedProfile}
<div class="page-header">
<h2 class="page-title">
<input type="text" class="inline-title-input" class:error={validationErrors.name}
bind:value={editingName} placeholder={getI18N('profileNamePlaceholder') || 'Profile name'} />
</h2>
{#if validationErrors.name}<div class="validation-error">{validationErrors.name}</div>{/if}
</div>

<!-- Priority -->
<div class="card">
<h3 class="card-title">{getI18N('priority') || 'Priority'}</h3>
<div class="form-group inline-form">
<input type="number" class="input input-sm" bind:value={editingPriority} min="0" max="100" style="width: 80px;" />
<span class="form-help">{getI18N('higherFirst') || 'Higher number = higher priority'}</span>
</div>
</div>

<!-- URL Conditions -->
<div class="card">
<h3 class="card-title">{getI18N('urlConditions') || 'URL Conditions'}</h3>
<p class="card-description">{getI18N('urlConditionsHelp') || 'This profile will be applied when URL matches any condition.'}</p>
{#if validationErrors.conditions}<div class="validation-error">{validationErrors.conditions}</div>{/if}
<div class="conditions-list">
{#each editingConditions as condition, index (condition.id)}
<div class="condition-item">
<select class="select select-sm" value={condition.type}
onchange={e => updateConditionType(index, (e.target as HTMLSelectElement).value as MatchType)}>
<option value="host-wildcard">{getMatchTypeLabel('host-wildcard')}</option>
<option value="url-wildcard">{getMatchTypeLabel('url-wildcard')}</option>
<option value="regex">{getMatchTypeLabel('regex')}</option>
</select>
<input type="text" class="input" class:error={validationErrors[`condition-${index}`]}
value={condition.pattern} oninput={e => updateConditionPattern(index, (e.target as HTMLInputElement).value)}
placeholder={condition.type === 'host-wildcard' ? '*.example.com' :
             condition.type === 'url-wildcard' ? '*://example.com/*' : '^https://.*\\.example\\.com/.*$'} />
<button class="btn-icon" onclick={() => removeCondition(index)} aria-label="Remove"></button>
</div>
{#if validationErrors[`condition-${index}`]}<div class="validation-error">{validationErrors[`condition-${index}`]}</div>{/if}
{/each}
</div>
<button class="btn btn-secondary btn-sm" onclick={addCondition} style="margin-top: 12px;">
+ {getI18N('addCondition') || 'Add Condition'}
</button>
</div>

<!-- Extension States -->
<div class="card">
<h3 class="card-title">{getI18N('extensionStates') || 'Extension States'}</h3>
<p class="card-description">{getI18N('extensionStatesHelp') || 'Configure how each extension behaves when this profile is active.'}</p>
<div class="extension-states">
{#each editingExtensionStates as ext (ext.id)}
<div class="extension-state-item">
<img src={pickBestIcon(ext.icons, 24)} alt="" class="ext-icon" />
<span class="ext-name">{ext.name}</span>
<div class="state-selector">
<button class="state-btn" class:active={ext.targetState === 'keep'}
onclick={() => updateExtensionState(ext.id, 'keep')} title={getI18N('keepState') || 'Keep'}></button>
<button class="state-btn enable" class:active={ext.targetState === 'enable'}
onclick={() => updateExtensionState(ext.id, 'enable')} title={getI18N('enable') || 'Enable'}></button>
<button class="state-btn disable" class:active={ext.targetState === 'disable'}
onclick={() => updateExtensionState(ext.id, 'disable')} title={getI18N('disable') || 'Disable'}></button>
</div>
</div>
{/each}
</div>
</div>

{:else}
<EmptyState icon="📋" title={getI18N('noProfiles') || 'No Profile Selected'}
description={getI18N('profilesDescription') || 'Profile groups can automatically enable/disable extensions based on the website you visit.'}
buttonText={getI18N('addProfile') || 'New Profile'} onAction={openNewProfileModal} />
{/if}
</div>
</main>
</div>

<Modal bind:show={showNewProfileModal} title={getI18N('newProfile') || 'New Profile'}>
{#snippet children()}
<div class="form-group">
<label class="form-label" for="new-profile-name">{getI18N('profileName') || 'Profile Name'}</label>
<input type="text" id="new-profile-name" class="input" bind:value={newProfileName}
placeholder={getI18N('profileNamePlaceholder') || 'e.g., Dev Sites'} />
</div>
{/snippet}
{#snippet footer()}
<button class="btn btn-secondary" onclick={() => (showNewProfileModal = false)}>{getI18N('cancel') || 'Cancel'}</button>
<button class="btn btn-primary" onclick={createNewProfile} disabled={!newProfileName.trim()}>{getI18N('create') || 'Create'}</button>
{/snippet}
</Modal>
