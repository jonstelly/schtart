export interface OidcConfiguration {
	issuerUrl: string;
	discoveryUrl: string;
	clientId: string;
	clientSecret: string;
}

export interface AuthConfiguration {
	passwordEnabled: boolean;
	oidc?: OidcConfiguration;
	registrationEmailAllowlist?: string[];
}

/** Validate auth-related deployment settings before constructing Better Auth. */
export function validateAuthConfiguration(
	environment: Record<string, string | undefined>
): AuthConfiguration {
	const passwordMode = environment.PASSWORD_AUTH_ENABLED?.trim().toLowerCase();
	if (passwordMode && passwordMode !== 'true' && passwordMode !== 'false') {
		throw new Error('PASSWORD_AUTH_ENABLED must be true or false when set.');
	}
	const passwordEnabled = passwordMode !== 'false';

	const issuerSetting = environment.OIDC_ISSUER_URL?.trim() ?? '';
	const clientId = environment.OIDC_CLIENT_ID?.trim() ?? '';
	const clientSecret = environment.OIDC_CLIENT_SECRET?.trim() ?? '';
	const configuredOidcFields = [issuerSetting, clientId, clientSecret].filter(Boolean).length;
	if (configuredOidcFields > 0 && configuredOidcFields < 3) {
		throw new Error(
			'OIDC configuration is incomplete. Set OIDC_ISSUER_URL, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET together.'
		);
	}

	let oidc: OidcConfiguration | undefined;
	if (configuredOidcFields === 3) {
		let issuer: URL;
		try {
			issuer = new URL(issuerSetting);
		} catch {
			throw new Error('OIDC_ISSUER_URL must be a valid absolute HTTP(S) URL.');
		}
		if (
			!['http:', 'https:'].includes(issuer.protocol) ||
			issuer.username ||
			issuer.password ||
			issuer.search ||
			issuer.hash
		) {
			throw new Error(
				'OIDC_ISSUER_URL must be a valid absolute HTTP(S) URL without credentials, query, or fragment.'
			);
		}
		const issuerUrl = issuer.toString().replace(/\/$/, '');
		oidc = {
			issuerUrl,
			discoveryUrl: `${issuerUrl}/.well-known/openid-configuration`,
			clientId,
			clientSecret
		};
	}

	if (!passwordEnabled && !oidc) {
		throw new Error(
			'No authentication method is enabled. Enable PASSWORD_AUTH_ENABLED or configure all OIDC settings.'
		);
	}

	const allowlistSetting = environment.REGISTRATION_EMAIL_ALLOWLIST?.trim();
	const registrationEmailAllowlist = allowlistSetting
		? allowlistSetting.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
		: undefined;

	return {
		passwordEnabled,
		oidc,
		registrationEmailAllowlist
	};
}

export function isRegistrationEmailAllowed(
	email: string,
	allowlistSetting?: string | string[]
) {
	const allowlist = Array.isArray(allowlistSetting)
		? allowlistSetting
		: allowlistSetting?.trim()
			? allowlistSetting.split(',').map((address) => address.trim().toLowerCase()).filter(Boolean)
			: undefined;
	if (!allowlist) return true;
	return allowlist.includes(email.trim().toLowerCase());
}
