<script lang="ts">
	import { onMount } from 'svelte';
	import { HighlightStyle, foldGutter, indentOnInput, syntaxHighlighting } from '@codemirror/language';
	import { EditorState } from '@codemirror/state';
	import { EditorView, drawSelection, highlightActiveLine, lineNumbers } from '@codemirror/view';
	import { yaml } from '@codemirror/lang-yaml';
	import { tags } from '@lezer/highlight';
	import type { EffectiveDashboardConfiguration } from '../dashboard';
	import { createDashboardEditorBehavior } from './dashboard-configuration-editor';
	import { Button } from './ui/button';

	let {
		initialYaml,
		onClose,
		onSaved
	}: {
		initialYaml: string;
		onClose: () => void;
		onSaved: (configuration: EffectiveDashboardConfiguration) => void;
	} = $props();

	let dialogElement: HTMLDialogElement;
	let editorHost: HTMLDivElement;
	let editorView: EditorView;
	let draft = $state('');
	let saving = $state(false);
	let resetting = $state(false);
	let errors = $state<string[]>([]);
	let notice = $state('');
	const yamlHighlightStyle = HighlightStyle.define([
		{ tag: tags.propertyName, color: 'var(--link)' },
		{ tag: tags.string, color: 'var(--primary)' },
		{ tag: tags.number, color: 'var(--heading-accent)' },
		{ tag: tags.bool, color: 'var(--heading-accent)' },
		{ tag: tags.atom, color: 'var(--heading-accent)' },
		{ tag: tags.comment, color: 'var(--muted-foreground)', fontStyle: 'italic' }
	]);

	onMount(() => {
		dialogElement.showModal();
		draft = initialYaml;
		const editorBehavior = createDashboardEditorBehavior(document.documentElement);
		editorView = new EditorView({
			state: EditorState.create({
				doc: initialYaml,
				extensions: [
					lineNumbers(),
					foldGutter(),
					drawSelection(),
					highlightActiveLine(),
					indentOnInput(),
					yaml(),
					syntaxHighlighting(yamlHighlightStyle),
					...editorBehavior.extensions,
					EditorView.lineWrapping,
					EditorView.updateListener.of((update) => {
						if (update.docChanged) draft = update.state.doc.toString();
					}),
				]
			}),
			parent: editorHost
		});
		const stopObservingTheme = editorBehavior.observeTheme(editorView);
		editorView.focus();

		return () => {
			stopObservingTheme();
			editorView.destroy();
		};
	});

	async function saveConfiguration() {
		saving = true;
		errors = [];
		notice = '';
		try {
			const response = await fetch('/api/configuration', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ yaml: draft })
			});
			const result = await response.json();
			if (!response.ok) {
				errors = Array.isArray(result.errors) ? result.errors : ['The configuration could not be saved.'];
				return;
			}
			onSaved(result as EffectiveDashboardConfiguration);
			notice = 'Your complete page layout has been saved.';
		} catch {
			errors = ['The server could not be reached. Your saved configuration has not changed.'];
		} finally {
			saving = false;
		}
	}

	async function resetConfiguration() {
		resetting = true;
		errors = [];
		notice = '';
		try {
			const response = await fetch('/api/configuration', { method: 'DELETE' });
			const result = await response.json();
			if (!response.ok) {
				errors = Array.isArray(result.errors) ? result.errors : ['The saved configuration could not be reset.'];
				return;
			}
			const configuration = result as EffectiveDashboardConfiguration;
			draft = configuration.yaml;
			editorView.dispatch({
				changes: { from: 0, to: editorView.state.doc.length, insert: configuration.yaml }
			});
			onSaved(configuration);
			notice = 'Your pages now follow the current server default.';
		} catch {
			errors = ['The server could not be reached. Your saved configuration has not changed.'];
		} finally {
			resetting = false;
		}
	}
</script>

<dialog
	bind:this={dialogElement}
	aria-labelledby="dashboard-editor-title"
	class="w-[min(58rem,calc(100vw-2rem))] max-w-none rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl shadow-black/30 backdrop:bg-black/55"
	onclose={onClose}
>
	<div class="flex max-h-[min(92vh,58rem)] flex-col overflow-hidden">
		<header class="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
			<div>
				<p class="text-[0.65rem] font-semibold uppercase tracking-[0.17em] text-link">Personal layout</p>
				<h2 id="dashboard-editor-title" class="mt-1 font-heading text-3xl font-normal tracking-tight text-heading">Shape your pages</h2>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Edit one complete YAML document. Saving replaces your entire layout; invalid changes leave the last saved version untouched.</p>
			</div>
			<Button variant="ghost" size="sm" onclick={() => dialogElement.close()}>Close</Button>
		</header>

		<div class="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
			<div class="mb-3 flex items-center justify-between gap-3">
				<p id="dashboard-yaml-label" class="text-sm font-semibold text-foreground">Dashboard YAML</p>
				<span class="text-xs text-muted-foreground">YAML · version 1</span>
			</div>
			<p id="dashboard-yaml-help" class="mb-3 text-xs leading-5 text-muted-foreground">
				Use registered widgets only. Each page has one to three columns; column order and widget order are preserved.
				Ctrl+[ / Ctrl+] outdent or indent (Command+[ / Command+] on macOS). Tab moves focus through the controls.
			</p>
			<div
				id="dashboard-yaml-editor"
				bind:this={editorHost}
				class="overflow-hidden rounded-lg border border-control-border bg-control"
			></div>

			{#if errors.length}
				<ul class="mt-4 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
					{#each errors as issue}
						<li>{issue}</li>
					{/each}
				</ul>
			{/if}
			{#if notice}
				<p class="mt-4 text-sm text-primary" role="status" aria-live="polite">{notice}</p>
			{/if}
		</div>

		<footer class="flex flex-col-reverse justify-between gap-3 border-t border-border bg-muted/35 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
			<Button variant="outline" onclick={resetConfiguration} disabled={resetting || saving}>
				{resetting ? 'Resetting…' : 'Reset to server default'}
			</Button>
			<div class="flex items-center justify-end gap-2">
				<Button variant="ghost" onclick={() => dialogElement.close()} disabled={saving || resetting}>Cancel</Button>
				<Button onclick={saveConfiguration} disabled={saving || resetting}>
					{saving ? 'Saving…' : 'Save complete layout'}
				</Button>
			</div>
		</footer>
	</div>
</dialog>

<style>
	dialog::backdrop {
		backdrop-filter: blur(4px);
	}
</style>
