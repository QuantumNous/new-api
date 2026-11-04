import type { APIRoute } from 'astro';
import spec from '../../data/relay.en.json?raw';
import { fillPlaceholders } from '../../site.mjs';

export const GET: APIRoute = () =>
	new Response(fillPlaceholders(spec), { headers: { 'Content-Type': 'application/json' } });
