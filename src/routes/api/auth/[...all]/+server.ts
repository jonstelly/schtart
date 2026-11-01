import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '../../../../lib/server/auth';

const handler = toSvelteKitHandler(auth);

export const GET = handler;
export const POST = handler;
