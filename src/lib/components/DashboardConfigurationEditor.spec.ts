import { readFileSync } from 'node:fs';
import { defaultKeymap } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';

const editor = readFileSync(new URL('./DashboardConfigurationEditor.svelte', import.meta.url), 'utf8');
const button = readFileSync(new URL('./ui/button/button.svelte', import.meta.url), 'utf8');

describe('dashboard configuration editor accessibility', () => {
	it('leaves Tab for focus navigation while documenting keyboard indentation', () => {
		const defaultKeys = defaultKeymap.map(({ key }) => key);
		expect(defaultKeys).not.toContain('Tab');
		expect(defaultKeys).toContain('Mod-[');
		expect(defaultKeys).toContain('Mod-]');
		expect(editor).not.toContain('indentWithTab');
		expect(editor).toContain('keymap.of(defaultKeymap)');
		expect(editor).toContain('Ctrl+[ / Ctrl+] outdent or indent');
		expect(editor).toContain('Command+[ / Command+] on macOS');
		expect(editor).toContain('Tab moves focus through the controls');
	});

	it('programmatically describes the editor and keeps reset/save actions keyboard reachable', () => {
		const editorHost = editor.indexOf('id="dashboard-yaml-editor"');
		const resetButton = editor.indexOf('<Button variant="outline" onclick={resetConfiguration}');
		const cancelButton = editor.indexOf('<Button variant="ghost" onclick={() => dialogElement.close()}');
		const saveButton = editor.indexOf('<Button onclick={saveConfiguration}');
		const nativeButton = button.slice(button.indexOf('<button'), button.indexOf('</button>'));

		expect(editor).toContain("'aria-labelledby': 'dashboard-yaml-label'");
		expect(editor).toContain("'aria-describedby': 'dashboard-yaml-help'");
		expect(editor).toContain('id="dashboard-yaml-label"');
		expect(editor).toContain('id="dashboard-yaml-help"');
		expect(resetButton).toBeGreaterThan(editorHost);
		expect(cancelButton).toBeGreaterThan(resetButton);
		expect(saveButton).toBeGreaterThan(cancelButton);
		expect(button).toContain('type = "button"');
		expect(nativeButton).toContain('{type}');
		expect(nativeButton).not.toContain('tabindex');
	});

	it('synchronizes CodeMirror dark-theme state with the root theme', () => {
		const themeCompartment = new Compartment();
		const darkState = EditorState.create({
			extensions: [themeCompartment.of(EditorView.darkTheme.of(true))]
		});
		expect(darkState.facet(EditorView.darkTheme)).toBe(true);

		const lightState = darkState.update({
			effects: themeCompartment.reconfigure(EditorView.darkTheme.of(false))
		}).state;
		expect(lightState.facet(EditorView.darkTheme)).toBe(false);

		expect(editor).toContain('new Compartment()');
		expect(editor).toContain("document.documentElement.classList.contains('dark')");
		expect(editor).toContain('new MutationObserver');
		expect(editor).toContain('themeCompartment.reconfigure(EditorView.darkTheme.of(isDark))');
	});
});
