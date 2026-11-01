import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
const authForm = readFileSync(new URL('../lib/components/AuthForm.svelte', import.meta.url), 'utf8');

function applyStoredTheme(theme: string | null) {
	const initialClasses = appHtml.match(/<html\b[^>]*\bclass="([^"]*)"/)?.[1];
	if (initialClasses === undefined) throw new Error('Missing initial html classes in app.html');
	const classes = new Set(initialClasses.split(/\s+/).filter(Boolean));
	if (!classes.has('dark')) throw new Error('Expected app.html to start in dark mode');
	const classList = {
		add: (name: string) => classes.add(name),
		remove: (name: string) => classes.delete(name),
		contains: (name: string) => classes.has(name)
	};
	const script = appHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
	if (!script) throw new Error('Missing early theme bootstrap script in app.html');

	runInNewContext(script, {
		document: { documentElement: { classList } },
		localStorage: { getItem: vi.fn(() => theme) }
	});

	return classes;
}

describe('authenticated start page theme continuity', () => {
	it('applies the saved light theme when authentication navigates to the start page', () => {
		const classes = applyStoredTheme('light');

		expect(classes.has('dark')).toBe(false);
		expect(page).toContain('bg-background text-foreground');
		expect(page).toContain('text-heading');
		expect(page).toContain('text-muted-foreground');
		expect(page).toContain('text-destructive');
		expect(page).toContain('aria-label="Dashboard pages"');
		expect(page).toContain("import ThemeToggle from '../lib/components/ThemeToggle.svelte'");
		expect(page).toContain("import { Button } from '#lib/components/ui/button'");
		expect(page).not.toMatch(/#[\da-f]{3,8}\b/i);
		expect(page).not.toMatch(/<style\b/i);
		expect(authForm).toContain("window.location.assign('/')");
	});

	it('keeps dark as the default when no preference was saved', () => {
		expect(applyStoredTheme(null).has('dark')).toBe(true);
	});
});
