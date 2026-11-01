import { expect, test } from './fixtures';

const customConfiguration = `version: 1
pages:
  home:
    columns:
      - - widget: system-status
  news:
    columns:
      - - widget: news-headlines
          count: 1
  sports:
    columns:
      - - widget: sports-scores
          league: NHL
  monitoring:
    columns:
      - - widget: welcome
`;

test.describe('password-only authentication', () => {
	test.use({ authMode: 'password-only' });

	test('setup and login do not offer OIDC', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/setup$/);
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Email address')).toBeVisible();
		await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Continue with OIDC' })).toHaveCount(0);

		await page.getByLabel('Username').fill('passwordonly');
		await page.getByLabel('Email address').fill('password-only@example.test');
		await page.getByLabel('Password', { exact: true }).fill('test-password-1234');
		await page.getByRole('button', { name: 'Create account', exact: true }).click();
		await expect(page).toHaveURL('/');

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Continue with OIDC' })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
		await page.getByLabel('Username').fill('passwordonly');
		await page.getByLabel('Password', { exact: true }).fill('test-password-1234');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page).toHaveURL('/');
	});
});

test.describe('OIDC-only authentication', () => {
	test.use({ authMode: 'oidc-only' });

	test('setup and login use the local identity provider without password registration', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL(/\/setup$/);
		await expect(page.getByLabel('Username')).toHaveCount(0);
		await expect(page.getByLabel('Email address')).toHaveCount(0);
		await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Continue with OIDC' })).toBeVisible();

		await page.goto('/register');
		await expect(page.getByLabel('Username')).toHaveCount(0);
		await expect(page.getByLabel('Email address')).toHaveCount(0);
		await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Create account with OIDC' })).toBeVisible();

		await page.goto('/setup');
		await page.getByRole('button', { name: 'Continue with OIDC' }).click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible();

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByLabel('Username')).toHaveCount(0);
		await expect(page.getByLabel('Email address')).toHaveCount(0);
		await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Create an account' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Continue with OIDC' })).toBeVisible();
		await page.getByRole('button', { name: 'Continue with OIDC' }).click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
	});
});

async function replaceEditorText(page: import('@playwright/test').Page, text: string) {
	const editor = page.locator('.cm-content[contenteditable="true"]');
	await editor.focus();
	await expect(editor).toBeFocused();
	await editor.press('ControlOrMeta+A');
	await page.keyboard.insertText(text);
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
	const dimensions = await page.evaluate(() => ({
		viewport: document.documentElement.clientWidth,
		content: document.documentElement.scrollWidth
	}));
	expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test(
	'first setup, authentication, dashboard editing, and deployment entry points work in a browser',
	async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');
		await expect(page).toHaveURL(/\/setup$/);
		await expect(page.getByRole('region', { name: 'Claim your start page.' })).toBeVisible();
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Email address')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Continue with OIDC' })).toBeVisible();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await expectNoHorizontalOverflow(page);

		await page.getByLabel('Username').fill('firstadmin');
		await page.getByLabel('Email address').fill('first-admin@example.test');
		await page.getByLabel('Password', { exact: true }).fill('test-password-1234');
		await page.getByRole('button', { name: 'Create account', exact: true }).click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible();
		await expect(page.getByText('Following the shared default')).toBeVisible();

		const pageNavigation = page.getByRole('navigation', { name: 'Main navigation' });
		for (const label of ['Home', 'News', 'Sports', 'Monitoring']) {
		const button = pageNavigation.getByRole('button', { name: label });
		await button.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { level: 1, name: `${label}.` })).toBeVisible();
		}
		await pageNavigation.getByRole('button', { name: 'Home' }).click();

		const editLayoutButton = page.getByRole('button', { name: 'Edit layout' });
		await editLayoutButton.focus();
		await page.keyboard.press('Enter');
		const dialog = page.getByRole('dialog', { name: 'Shape your pages' });
		await expect(dialog).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();

		await page.getByRole('button', { name: 'Edit layout' }).click();
		await expect(dialog).toBeVisible();
		await replaceEditorText(page, 'version: [');
		await page.getByRole('button', { name: 'Save complete layout' }).click();
		await expect(dialog.getByRole('alert')).toBeVisible();

		await replaceEditorText(page, customConfiguration);
		await page.getByRole('button', { name: 'Save complete layout' }).click();
		await expect(dialog.getByRole('status')).toContainText('Your complete page layout has been saved.');
		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('heading', { name: 'All in view' })).toBeVisible();
		await expect(page.getByText('Your personal layout')).toBeVisible();

		await page.getByRole('button', { name: 'Edit layout' }).click();
		await page.getByRole('button', { name: 'Reset to server default' }).click();
		await expect(page.getByRole('status')).toContainText('Your pages now follow the current server default.');
		await page.getByRole('button', { name: 'Close' }).click();
		await expect(page.getByRole('heading', { name: 'A clear start' })).toBeVisible();
		await expect(page.getByText('Following the shared default')).toBeVisible();

		await page.getByRole('button', { name: 'Admin' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Admin.' })).toBeVisible();
		await expect(
		page.getByRole('navigation', { name: 'Admin settings' }).getByRole('button', { name: 'Default start page' })
		).toBeVisible();
		await page.getByRole('button', { name: 'Edit default start page' }).click();
		const defaultDialog = page.getByRole('dialog', { name: 'Set the shared starting point' });
		await expect(defaultDialog).toBeVisible();
		await replaceEditorText(page, customConfiguration);
		await page.getByRole('button', { name: 'Save shared default' }).click();
		await expect(defaultDialog.getByRole('status')).toContainText('The shared default has been updated.');
		await page.getByRole('button', { name: 'Close' }).click();
		await page.reload();
		await expect(page.getByRole('heading', { name: 'All in view' })).toBeVisible();
		await page.getByRole('button', { name: 'Home' }).click();
		await expect(page.getByRole('heading', { name: 'All in view' })).toBeVisible();

		await page.getByRole('button', { name: 'Switch to light theme' }).click();
		await expect(page.locator('html')).not.toHaveClass(/dark/);
		await expect.poll(() => page.evaluate(() => localStorage.getItem('schtart-theme'))).toBe('light');
		await page.reload();
		await expect(page.locator('html')).not.toHaveClass(/dark/);
		await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

		await page.setViewportSize({ width: 375, height: 812 });
		await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Continue with OIDC' })).toBeVisible();
		await page.getByLabel('Username').fill('firstadmin');
		await page.getByLabel('Password', { exact: true }).fill('test-password-1234');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page).toHaveURL('/');

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/login$/);
		await page.getByRole('link', { name: 'Create an account' }).click();
		await expect(page).toHaveURL(/\/register$/);
		await expect(page.getByRole('button', { name: 'Create account with OIDC' })).toBeVisible();
		await expect(page.getByLabel('Username')).toBeVisible();
		await page.getByRole('button', { name: 'Create account with OIDC' }).click();
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Admin' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'All in view' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
		await expect(page.locator('html')).not.toHaveClass(/dark/);
		await expectNoHorizontalOverflow(page);
	}
);
