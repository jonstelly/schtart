import { defaultKeymap } from '@codemirror/commands';
import { Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

type DashboardEditorView = Pick<EditorView, 'state' | 'dispatch'>;
type RootClassObserver = {
	observe: (root: Element, options: MutationObserverInit) => void;
	disconnect: () => void;
};
type RootClassObserverFactory = (onChange: () => void) => RootClassObserver;

const observeRootClassChanges: RootClassObserverFactory = (onChange) => {
	const observer = new MutationObserver(onChange);
	return {
		observe: (root, options) => observer.observe(root, options),
		disconnect: () => observer.disconnect()
	};
};

export function createDashboardEditorBehavior(
	root: Element,
	createObserver: RootClassObserverFactory = observeRootClassChanges
) {
	const themeCompartment = new Compartment();
	const themeStyles = {
		'&': {
			backgroundColor: 'var(--control)',
			color: 'var(--control-foreground)',
			fontSize: '0.82rem',
			minHeight: '22rem'
		},
		'.cm-content': {
			minHeight: '22rem',
			padding: '1rem 0',
			caretColor: 'var(--editor-caret)'
		},
		'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-caret)' },
		'.cm-selectionBackground': { backgroundColor: 'var(--editor-selection)' },
		// Repeating the focus class raises specificity above CodeMirror's focused light/dark rule.
		'&.cm-editor.cm-focused.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
			backgroundColor: 'var(--editor-selection)'
		},
		'.cm-gutters': {
			backgroundColor: 'var(--muted)',
			color: 'var(--muted-foreground)',
			borderRight: '1px solid var(--border)'
		},
		'.cm-activeLine': { backgroundColor: 'color-mix(in oklch, var(--primary) 8%, transparent)' },
		'&.cm-focused': { outline: '2px solid var(--ring)', outlineOffset: '-2px' }
	} satisfies Parameters<typeof EditorView.theme>[0];
	const theme = EditorView.theme(themeStyles);
	const isInitiallyDark = root.classList.contains('dark');

	return {
		extensions: [
			keymap.of(defaultKeymap),
			themeCompartment.of(EditorView.darkTheme.of(isInitiallyDark)),
			theme,
			EditorView.contentAttributes.of({
				'aria-labelledby': 'dashboard-yaml-label',
				'aria-describedby': 'dashboard-yaml-help'
			})
		],
		theme,
		themeStyles,
		observeTheme(view: DashboardEditorView) {
			const observer = createObserver(() => {
				const isDark = root.classList.contains('dark');
				if (view.state.facet(EditorView.darkTheme) !== isDark) {
					view.dispatch({ effects: themeCompartment.reconfigure(EditorView.darkTheme.of(isDark)) });
				}
			});
			observer.observe(root, { attributes: true, attributeFilter: ['class'] });
			return () => observer.disconnect();
		}
	};
}
