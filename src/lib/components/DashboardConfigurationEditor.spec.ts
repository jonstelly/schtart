import { render } from 'svelte/server';
import { EditorSelection, EditorState, type Transaction } from '@codemirror/state';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import DashboardConfigurationEditor from './DashboardConfigurationEditor.svelte';
import { createDashboardEditorBehavior } from './dashboard-configuration-editor';

function rootTheme(isDark: boolean): Element {
	const classes = new Set(isDark ? ['dark'] : []);
	return {
		classList: {
			contains: (className: string) => classes.has(className),
			add: (className: string) => classes.add(className),
			remove: (className: string) => classes.delete(className)
		}
	} as unknown as Element;
}

function makeView(state: EditorState): EditorView {
	let currentState = state;
	return {
		get state() {
			return currentState;
		},
		dispatch(transaction: Transaction) {
			currentState = currentState.update(transaction).state;
		}
	} as unknown as EditorView;
}

function pressKey(view: EditorView, key: string, options: { ctrlKey?: boolean; shiftKey?: boolean } = {}) {
	let defaultPrevented = false;
	const event = {
		type: 'keydown',
		key,
		keyCode: key === 'Tab' ? 9 : key === ']' ? 221 : key === '[' ? 219 : 0,
		shiftKey: options.shiftKey ?? false,
		ctrlKey: options.ctrlKey ?? false,
		metaKey: false,
		altKey: false,
		get defaultPrevented() {
			return defaultPrevented;
		},
		preventDefault() {
			defaultPrevented = true;
		},
		stopPropagation() {}
	} as KeyboardEvent;
	const handled = runScopeHandlers(view, event, 'editor');
	return { handled, defaultPrevented: event.defaultPrevented };
}

function classSpecificity(selector: string): number {
	return (selector.match(/&|\.[\w-]+/g) ?? []).length;
}

describe('dashboard configuration editor behavior', () => {
	it('starts with CodeMirror dark mode when the root has the dark class', () => {
		const setup = createDashboardEditorBehavior(rootTheme(true));
		const state = EditorState.create({ doc: 'Home:\n', extensions: setup.extensions });

		expect(state.facet(EditorView.darkTheme)).toBe(true);
		expect(state.facet(EditorView.contentAttributes)[0]).toEqual({
			'aria-labelledby': 'dashboard-yaml-label',
			'aria-describedby': 'dashboard-yaml-help'
		});
	});

	it('tracks root theme mutations through CodeMirror state and centralized editor tokens', () => {
		const root = rootTheme(true);
		let notifyThemeChange: MutationCallback | undefined;
		let observedTarget: unknown;
		let observedOptions: MutationObserverInit | undefined;
		const setup = createDashboardEditorBehavior(root, (callback) => {
			notifyThemeChange = callback;
			return {
				observe(target, options) {
					observedTarget = target;
					observedOptions = options;
				},
				disconnect() {}
			};
		});
		let state = EditorState.create({ doc: 'Home:\n', extensions: setup.extensions });
		const view = makeView(state);
		const stopObserving = setup.observeTheme(view);

		expect(state.facet(EditorView.darkTheme)).toBe(true);
		expect(observedTarget).toBe(root);
		expect(observedOptions).toEqual({ attributes: true, attributeFilter: ['class'] });

		root.classList.remove('dark');
		notifyThemeChange?.([], {} as MutationObserver);
		state = view.state;
		expect(state.facet(EditorView.darkTheme)).toBe(false);

		const selectedContentStyles = setup.themeStyles['.cm-content'] as Record<string, string>;
		const cursorStyles = setup.themeStyles['.cm-cursor, .cm-dropCursor'] as Record<string, string>;
		const focusedSelectionSelector =
			'&.cm-editor.cm-focused.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground';
		expect(selectedContentStyles.caretColor).toBe('var(--editor-caret)');
		expect(cursorStyles.borderLeftColor).toBe('var(--editor-caret)');
		expect(setup.themeStyles['.cm-selectionBackground']).toEqual({
			backgroundColor: 'var(--editor-selection)'
		});
		expect(setup.themeStyles[focusedSelectionSelector]).toEqual({
			backgroundColor: 'var(--editor-selection)'
		});
		expect(classSpecificity(focusedSelectionSelector)).toBeGreaterThan(
			classSpecificity('&dark.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground')
		);
		expect(setup.extensions).toContain(setup.theme);

		stopObserving();
	});

	it('leaves Tab and Shift-Tab unhandled while keeping keyboard indent and outdent available', () => {
		const setup = createDashboardEditorBehavior(rootTheme(true));
		const view = makeView(
			EditorState.create({
				doc: 'alpha:\n  beta',
				selection: EditorSelection.cursor(0),
				extensions: setup.extensions
			})
		);

		expect(pressKey(view, 'Tab')).toEqual({ handled: false, defaultPrevented: false });
		expect(pressKey(view, 'Tab', { shiftKey: true })).toEqual({ handled: false, defaultPrevented: false });
		expect(pressKey(view, ']', { ctrlKey: true }).handled).toBe(true);
		expect(view.state.doc.toString()).toBe('  alpha:\n  beta');
		expect(pressKey(view, '[', { ctrlKey: true }).handled).toBe(true);
		expect(view.state.doc.toString()).toBe('alpha:\n  beta');
	});

	it('renders named editor controls and keeps Save and Reset in the tab order', () => {
		const { body } = render(DashboardConfigurationEditor, {
			props: { initialYaml: 'Home:\n', onClose() {}, onSaved() {} }
		});
		const buttons = [...body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attributes, content]) => ({
			attributes,
			name: content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
		}));

		expect(body).toContain('aria-labelledby="dashboard-editor-title"');
		expect(body).toContain('id="dashboard-yaml-label"');
		expect(body).toContain('id="dashboard-yaml-help"');
		expect(body).toContain('Ctrl+[ / Ctrl+] outdent or indent');
		expect(body).toContain('Command+[ / Command+] on macOS');
		expect(body).toContain('Tab moves focus through the controls');
		expect(buttons.map(({ name }) => name)).toEqual([
			'Close',
			'Reset to server default',
			'Cancel',
			'Save complete layout'
		]);
		for (const { attributes } of buttons) {
			expect(attributes).toContain('type="button"');
			expect(attributes).not.toMatch(/\bdisabled(?:\s|=|>)/);
			expect(attributes).not.toMatch(/\btabindex=/i);
		}
	});
});
