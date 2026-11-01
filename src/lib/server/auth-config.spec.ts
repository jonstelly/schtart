import { describe, expect, it } from 'vitest';
import { isRegistrationEmailAllowed, validateAuthConfiguration } from './auth-config';

const credentials = {
	OIDC_ISSUER_URL: 'https://identity.example.test',
	OIDC_CLIENT_ID: 'schtart',
	OIDC_CLIENT_SECRET: 'client-secret'
};

describe('auth configuration', () => {
	it('enables password auth by default and hides an unconfigured OIDC provider', () => {
		expect(validateAuthConfiguration({})).toMatchObject({
			passwordEnabled: true,
			oidc: undefined,
			registrationEmailAllowlist: undefined
		});
	});

	it('preserves the configured issuer identity and derives a normalized discovery URL', () => {
		expect(validateAuthConfiguration(credentials)).toMatchObject({
			passwordEnabled: true,
			oidc: {
				issuerUrl: 'https://identity.example.test',
				discoveryUrl: 'https://identity.example.test/.well-known/openid-configuration',
				clientId: 'schtart',
				clientSecret: 'client-secret'
			}
		});
	});

	it('preserves trailing slash, host casing, explicit port, and escaped path in the issuer identity', () => {
		const configuration = validateAuthConfiguration({
			...credentials,
			OIDC_ISSUER_URL: 'https://Identity.Example.Test:443/tenant%2Fblue/'
		});

		expect(configuration.oidc).toMatchObject({
			issuerUrl: 'https://Identity.Example.Test:443/tenant%2Fblue/',
			discoveryUrl:
				'https://identity.example.test/tenant%2Fblue/.well-known/openid-configuration'
		});
	});

	it('accepts OIDC-only mode', () => {
		expect(
			validateAuthConfiguration({ ...credentials, PASSWORD_AUTH_ENABLED: 'false' })
		).toMatchObject({ passwordEnabled: false, oidc: { clientId: 'schtart' } });
	});

	it.each([
		['OIDC_ISSUER_URL', { OIDC_CLIENT_ID: 'schtart', OIDC_CLIENT_SECRET: 'secret' }],
		['OIDC_CLIENT_ID', { OIDC_ISSUER_URL: 'https://identity.example.test', OIDC_CLIENT_SECRET: 'secret' }],
		['OIDC_CLIENT_SECRET', { OIDC_ISSUER_URL: 'https://identity.example.test', OIDC_CLIENT_ID: 'schtart' }]
	])('rejects incomplete OIDC configuration when %s is missing', (_, partial) => {
		expect(() => validateAuthConfiguration(partial)).toThrow(/OIDC_ISSUER_URL, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET/);
	});

	it('rejects an instance with both authentication methods disabled', () => {
		expect(() =>
			validateAuthConfiguration({ PASSWORD_AUTH_ENABLED: 'false' })
		).toThrow(/Enable PASSWORD_AUTH_ENABLED or configure all OIDC settings/);
	});

	it('rejects invalid password mode and malformed issuer settings with actionable errors', () => {
		expect(() => validateAuthConfiguration({ PASSWORD_AUTH_ENABLED: 'sometimes' })).toThrow(
			/PASSWORD_AUTH_ENABLED must be true or false/
		);
		expect(() =>
			validateAuthConfiguration({ ...credentials, OIDC_ISSUER_URL: 'not a URL' })
		).toThrow(/OIDC_ISSUER_URL must be a valid absolute HTTP\(S\) URL/);
		expect(() =>
			validateAuthConfiguration({ ...credentials, OIDC_ISSUER_URL: ' https://identity.example.test' })
		).toThrow(/OIDC_ISSUER_URL must not contain surrounding whitespace/);
	});

	it('parses the optional registration allowlist as exact normalized addresses', () => {
		const configuration = validateAuthConfiguration({
			REGISTRATION_EMAIL_ALLOWLIST: ' Ada@Example.Test, , GRACE@example.test '
		});

		expect(configuration.registrationEmailAllowlist).toEqual([
			'ada@example.test',
			'grace@example.test'
		]);
	});

	it('matches allowlisted registration emails exactly after case and whitespace normalization', () => {
		expect(isRegistrationEmailAllowed(' ADA@example.test ', 'ada@example.test')).toBe(true);
		expect(isRegistrationEmailAllowed('ada@sub.example.test', 'ada@example.test')).toBe(false);
		expect(isRegistrationEmailAllowed('ada@example.test', ',,')).toBe(false);
	});
});
