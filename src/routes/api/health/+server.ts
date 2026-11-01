import { json } from '@sveltejs/kit';

export function GET() {
	return json({ status: 'ok', time: new Date().toISOString() });
}
