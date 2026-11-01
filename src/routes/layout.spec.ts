import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./layout.css', import.meta.url), 'utf8');
const buttonStyles = readFileSync(new URL('../lib/components/ui/button/button.svelte', import.meta.url), 'utf8');
const inputStyles = readFileSync(new URL('../lib/components/ui/input/input.svelte', import.meta.url), 'utf8');
const dashboardEditor = readFileSync(new URL('../lib/components/DashboardConfigurationEditor.svelte', import.meta.url), 'utf8');

type Oklch = { lightness: number; chroma: number; hue: number };

type Theme = ':root' | '.dark';

function declaration(selector: Theme, name: string): Oklch {
	const block = stylesheet.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]+)\\}`))?.[1];
	const value = block?.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`))?.[1];
	if (!value) throw new Error(`Missing --${name} oklch token in ${selector}`);

	const [lightness, chroma, hue] = value.trim().split(/\s+/).map(Number);
	return { lightness, chroma, hue };
}

function rawLinearSrgb({ lightness, chroma, hue }: Oklch): [number, number, number] {
	const radians = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(radians);
	const b = chroma * Math.sin(radians);
	const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
	const l = lPrime ** 3;
	const m = mPrime ** 3;
	const s = sPrime ** 3;

	// CSS Color 4 OKLab-to-linear-sRGB matrix.
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	];
}

function linearSrgb(color: Oklch): [number, number, number] {
	return rawLinearSrgb(color).map((channel) => Math.max(0, Math.min(1, channel))) as [number, number, number];
}

function luminance(color: Oklch): number {
	const [red, green, blue] = linearSrgb(color);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: Oklch, second: Oklch): number {
	const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
	return (lighter + 0.05) / (darker + 0.05);
}

function expectContrast(theme: Theme, foreground: string, background: string, minimum: number) {
	const ratio = contrastRatio(declaration(theme, foreground), declaration(theme, background));
	expect(ratio, `${theme} --${foreground} on --${background}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum);
}

describe('centralized auth theme contrast', () => {
	const themes: Theme[] = [':root', '.dark'];
	const authColors = [
		'auth-page', 'auth-card', 'auth-control', 'auth-control-text', 'auth-control-border',
		'auth-notice', 'auth-body', 'auth-muted', 'auth-heading', 'auth-link', 'auth-heading-accent',
		'auth-focus', 'auth-muted-surface', 'auth-primary-action', 'auth-primary-action-text',
		'auth-primary-action-hover', 'auth-secondary-action', 'auth-secondary-action-text',
		'auth-secondary-action-hover', 'auth-danger-text', 'auth-danger-action',
		'auth-danger-action-text', 'auth-danger-action-hover'
	];

	it('keeps semantic auth colors in the sRGB gamut used for contrast calculations', () => {
		for (const theme of themes) {
			for (const name of authColors) {
				const channels = rawLinearSrgb(declaration(theme, name));
				expect(channels.every((channel) => channel >= 0 && channel <= 1), `${theme} --${name} must be in gamut`).toBe(true);
			}
		}
	});

	it('keeps every auth text role readable on the surfaces where it appears', () => {
		for (const theme of themes) {
			for (const surface of ['auth-page', 'auth-card', 'auth-control', 'auth-notice']) {
				expectContrast(theme, 'auth-body', surface, 4.5);
				expectContrast(theme, 'auth-muted', surface, 4.5);
				expectContrast(theme, 'auth-link', surface, 4.5);
				expectContrast(theme, 'auth-danger-text', surface, 4.5);
			}
			for (const surface of ['auth-page', 'auth-card', 'auth-notice']) {
				expectContrast(theme, 'auth-primary-action', surface, 4.5);
			}

			for (const surface of ['auth-page', 'auth-card']) {
				expectContrast(theme, 'auth-heading', surface, 3);
				expectContrast(theme, 'auth-heading-accent', surface, 3);
			}
		}
	});

	it('keeps shared button variant foregrounds readable in default and hover states', () => {
		for (const theme of themes) {
			for (const background of ['auth-primary-action', 'auth-primary-action-hover']) {
				expectContrast(theme, 'auth-primary-action-text', background, 4.5);
			}
			for (const background of ['auth-secondary-action', 'auth-secondary-action-hover']) {
				expectContrast(theme, 'auth-secondary-action-text', background, 4.5);
			}
			expectContrast(theme, 'auth-control-text', 'auth-control', 4.5);
			expectContrast(theme, 'auth-control-text', 'auth-secondary-action-hover', 4.5);
			expectContrast(theme, 'auth-body', 'auth-muted-surface', 4.5);
			expectContrast(theme, 'auth-danger-action-text', 'auth-danger-action', 4.5);
			expectContrast(theme, 'auth-danger-action-text', 'auth-danger-action-hover', 4.5);

			for (const surface of ['auth-page', 'auth-card', 'auth-control', 'auth-muted-surface', 'auth-notice']) {
				expectContrast(theme, 'auth-focus', surface, 3);
			}
		}
	});

	it('keeps control boundaries distinct from their fill in both themes', () => {
		for (const theme of themes) {
			expectContrast(theme, 'auth-control-border', 'auth-control', 3);
		}
	});

	it('routes shared theme roles and component focus styles through the auth tokens', () => {
		for (const theme of themes) {
			const block = stylesheet.match(new RegExp(`${theme.replace('.', '\\.')}\\s*\\{([^}]+)\\}`))?.[1];
			expect(block).toContain('--background: var(--auth-page)');
			expect(block).toContain('--foreground: var(--auth-body)');
			expect(block).toContain('--card: var(--auth-card)');
			expect(block).toContain('--muted-foreground: var(--auth-muted)');
			expect(block).toContain('--link: var(--auth-link)');
			expect(block).toContain('--heading: var(--auth-heading)');
			expect(block).toContain('--heading-accent: var(--auth-heading-accent)');
			expect(block).toContain('--control: var(--auth-control)');
			expect(block).toContain('--control-foreground: var(--auth-control-text)');
			expect(block).toContain('--control-border: var(--auth-control-border)');
			expect(block).toContain('--primary: var(--auth-primary-action)');
			expect(block).toContain('--primary-foreground: var(--auth-primary-action-text)');
			expect(block).toContain('--primary-hover: var(--auth-primary-action-hover)');
			expect(block).toContain('--secondary: var(--auth-secondary-action)');
			expect(block).toContain('--secondary-foreground: var(--auth-secondary-action-text)');
			expect(block).toContain('--secondary-hover: var(--auth-secondary-action-hover)');
			expect(block).toContain('--destructive-button: var(--auth-danger-action)');
			expect(block).toContain('--destructive-button-foreground: var(--auth-danger-action-text)');
			expect(block).toContain('--destructive-button-hover: var(--auth-danger-action-hover)');
			expect(block).toContain('--ring: var(--auth-focus)');
			expect(block).toContain('--notice: var(--auth-notice)');
		}

		expect(stylesheet).toContain('--color-heading: var(--heading)');
		expect(stylesheet).toContain('--color-control: var(--control)');
		expect(stylesheet).toContain('--color-primary-hover: var(--primary-hover)');
		expect(buttonStyles).toContain('default: "bg-primary text-primary-foreground hover:bg-primary-hover"');
		expect(buttonStyles).toContain('outline: "border-control-border bg-control text-control-foreground');
		expect(buttonStyles).toContain('secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:');
		expect(buttonStyles).toContain('ghost: "hover:bg-muted hover:text-foreground');
		expect(buttonStyles).toContain('destructive: "bg-destructive-button text-destructive-button-foreground');
		expect(buttonStyles).toContain('link: "text-link');
		expect(inputStyles).toContain('border-control-border bg-control text-control-foreground');
		expect(buttonStyles).toContain('focus-visible:ring-ring');
		expect(inputStyles).toContain('focus-visible:ring-ring');
		expect(buttonStyles).not.toContain('focus-visible:ring-ring/50');
		expect(inputStyles).not.toContain('focus-visible:ring-ring/50');
	});
});

describe('CodeMirror theme tokens', () => {
	it('defines semantic caret and selection colors for both dashboard themes', () => {
		for (const theme of [':root', '.dark'] as const) {
			const block = stylesheet.match(new RegExp(`${theme.replace('.', '\\.')}\\s*\\{([^}]+)\\}`))?.[1];
			expect(block).toContain('--editor-caret: var(--auth-focus)');
			expect(block).toContain('--editor-selection: color-mix(in oklch, var(--auth-focus) 24%, var(--auth-control))');
		}

		expect(dashboardEditor).toContain("caretColor: 'var(--editor-caret)'");
		expect(dashboardEditor).toContain("borderLeftColor: 'var(--editor-caret)'");
		expect(dashboardEditor).toContain("backgroundColor: 'var(--editor-selection)'");
	});
});
