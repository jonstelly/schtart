import {
	createHash,
	generateKeyPairSync,
	randomBytes,
	sign,
	timingSafeEqual
} from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface OidcIdentity {
	sub: string;
	email: string;
	name: string;
	emailVerified?: boolean;
}

interface PendingAuthorization {
	identity: OidcIdentity;
	nonce: string;
	redirectUri: string;
	codeChallenge: string;
}

function json(response: ServerResponse, status: number, value: unknown) {
	response.writeHead(status, { 'content-type': 'application/json' });
	response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage) {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks).toString('utf8');
}

function matchesChallenge(verifier: string, challenge: string) {
	const actual = createHash('sha256').update(verifier).digest('base64url');
	const actualBuffer = Buffer.from(actual);
	const expectedBuffer = Buffer.from(challenge);
	return (
		actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
	);
}

/** A tiny loopback-only OIDC provider for exercising Better Auth's real HTTP flow. */
export class LocalOidcProvider {
	private readonly keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
	private readonly kid = randomBytes(8).toString('hex');
	private readonly authorizations = new Map<string, PendingAuthorization>();
	private readonly accessTokens = new Map<string, OidcIdentity>();
	private nextIdentity: OidcIdentity = {
		sub: 'default-subject',
		email: 'default@example.test',
		name: 'Default User',
		emailVerified: true
	};
	private omitIdToken = false;
	private discoveryIssuer?: string;
	private server?: Server;
	issuerUrl = '';

	async start() {
		this.server = createServer((request, response) => void this.handle(request, response));
		await new Promise<void>((resolve, reject) => {
			this.server?.once('error', reject);
			this.server?.listen(0, '127.0.0.1', resolve);
		});
		const address = this.server.address() as AddressInfo;
		this.issuerUrl = `http://127.0.0.1:${address.port}`;
	}

	async stop() {
		if (!this.server) return;
		const server = this.server;
		this.server = undefined;
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	}

	useIdentity(identity: OidcIdentity) {
		this.nextIdentity = { emailVerified: true, ...identity };
	}

	setOmitIdToken(omit: boolean) {
		this.omitIdToken = omit;
	}

	setDiscoveryIssuer(issuer?: string) {
		this.discoveryIssuer = issuer;
	}

	private async handle(request: IncomingMessage, response: ServerResponse) {
		try {
			const url = new URL(request.url ?? '/', this.issuerUrl);
			if (request.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
				return json(response, 200, {
					issuer: this.discoveryIssuer ?? this.issuerUrl,
					authorization_endpoint: `${this.issuerUrl}/authorize`,
					token_endpoint: `${this.issuerUrl}/token`,
					userinfo_endpoint: `${this.issuerUrl}/userinfo`,
					jwks_uri: `${this.issuerUrl}/jwks`,
					response_types_supported: ['code'],
					subject_types_supported: ['public'],
					id_token_signing_alg_values_supported: ['RS256'],
					token_endpoint_auth_methods_supported: ['client_secret_post']
				});
			}
			if (request.method === 'GET' && url.pathname === '/jwks') {
				const publicKey = this.keyPair.publicKey.export({ format: 'jwk' });
				return json(response, 200, {
					keys: [{ ...publicKey, kid: this.kid, use: 'sig', alg: 'RS256' }]
				});
			}
			if (request.method === 'GET' && url.pathname === '/authorize') {
				if (
					url.searchParams.get('client_id') !== 'schtart-test-client' ||
					url.searchParams.get('response_type') !== 'code' ||
					!url.searchParams.get('redirect_uri') ||
					!url.searchParams.get('state') ||
					!url.searchParams.get('nonce') ||
					url.searchParams.get('code_challenge_method') !== 'S256' ||
					!url.searchParams.get('scope')?.split(/\s+/).includes('openid')
				) {
					return json(response, 400, { error: 'invalid_request' });
				}
				const code = randomBytes(24).toString('base64url');
				this.authorizations.set(code, {
					identity: this.nextIdentity,
					nonce: url.searchParams.get('nonce') ?? '',
					redirectUri: url.searchParams.get('redirect_uri') ?? '',
					codeChallenge: url.searchParams.get('code_challenge') ?? ''
				});
				const callback = new URL(url.searchParams.get('redirect_uri') ?? '');
				callback.searchParams.set('code', code);
				callback.searchParams.set('state', url.searchParams.get('state') ?? '');
				response.writeHead(302, { location: callback.toString() });
				return response.end();
			}
			if (request.method === 'POST' && url.pathname === '/token') {
				const form = new URLSearchParams(await readBody(request));
				const code = form.get('code') ?? '';
				const pending = this.authorizations.get(code);
				if (
					form.get('client_id') !== 'schtart-test-client' ||
					form.get('client_secret') !== 'local-test-client-secret' ||
					!pending ||
					form.get('redirect_uri') !== pending.redirectUri ||
					!matchesChallenge(form.get('code_verifier') ?? '', pending.codeChallenge)
				) {
					return json(response, 400, { error: 'invalid_grant' });
				}
				this.authorizations.delete(code);
				const accessToken = randomBytes(24).toString('base64url');
				this.accessTokens.set(accessToken, pending.identity);
				const now = Math.floor(Date.now() / 1000);
				const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: this.kid, typ: 'JWT' })).toString(
					'base64url'
				);
				const payload = Buffer.from(
					JSON.stringify({
						iss: this.discoveryIssuer ?? this.issuerUrl,
						sub: pending.identity.sub,
						aud: form.get('client_id'),
						exp: now + 300,
						iat: now,
						nonce: pending.nonce,
						email: pending.identity.email,
						email_verified: pending.identity.emailVerified,
						name: pending.identity.name
					})
				).toString('base64url');
				const input = `${header}.${payload}`;
				const signature = sign('RSA-SHA256', Buffer.from(input), this.keyPair.privateKey).toString(
					'base64url'
				);
				return json(response, 200, {
					access_token: accessToken,
					token_type: 'Bearer',
					expires_in: 300,
					...(this.omitIdToken ? {} : { id_token: `${input}.${signature}` })
				});
			}
			if (request.method === 'GET' && url.pathname === '/userinfo') {
				const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
				const identity = this.accessTokens.get(token);
				if (!identity) return json(response, 401, { error: 'invalid_token' });
				return json(response, 200, {
					sub: identity.sub,
					email: identity.email,
					email_verified: identity.emailVerified,
					name: identity.name
				});
			}
			return json(response, 404, { error: 'not_found' });
		} catch (error) {
			console.error('Local OIDC test provider failed:', error);
			return json(response, 500, { error: 'server_error' });
		}
	}
}
