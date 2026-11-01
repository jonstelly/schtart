import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('./layout.css', import.meta.url), 'utf8');

type Oklch = { lightness: number; chroma: number; hue: number };

function declaration(selector: ':root' | '.dark', name: string): Oklch {
	const block = stylesheet.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]+)\\}`))?.[1];
	const value = block?.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`))?.[1];
	if (!value) throw new Error(`Missing --${name} oklch token in ${selector}`);

	const [lightness, chroma, hue] = value.trim().split(/\s+/).map(Number);
	return { lightness, chroma, hue };
}

function linearSrgb({ lightness, chroma, hue }: Oklch): [number, number, number] {
	const radians = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(radians);
	const b = chroma * Math.sin(radians);
	const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
	const l = lPrime ** 3;
	const m = mPrime ** 3;
	const s = sPrime ** 3;

	// CSS Color 4 OKLab-to-linear-sRGB matrix, clipped to the sRGB display gamut.
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	].map((channel) => Math.max(0, Math.min(1, channel))) as [number, number, number];
}

function luminance(color: Oklch): number {
	const [red, green, blue] = linearSrgb(color);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: Oklch, second: Oklch): number {
	const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
	return (lighter + 0.05) / (darker + 0.05);
}

describe('theme text contrast', () => {
	it('keeps the link accent readable on page and card surfaces in both themes', () => {
		for (const selector of [':root', '.dark'] as const) {
			const background = declaration(selector, 'background');
			const card = declaration(selector, 'card');
			const link = declaration(selector, 'link');

			expect(contrastRatio(link, background)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(link, card)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('keeps the primary button foreground readable without changing its background token', () => {
		for (const selector of [':root', '.dark'] as const) {
			const primary = declaration(selector, 'primary');
			const foreground = declaration(selector, 'primary-foreground');

			expect(contrastRatio(foreground, primary)).toBeGreaterThanOrEqual(4.5);
		}
	});
});
