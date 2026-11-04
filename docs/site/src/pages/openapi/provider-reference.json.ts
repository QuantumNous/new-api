import type { APIRoute } from 'astro';
import catalog from '../../data/provider-reference.json?raw';
import { fillPlaceholders } from '../../site.mjs';

export const GET: APIRoute = () =>
	new Response(fillPlaceholders(catalog), { headers: { 'Content-Type': 'application/json' } });
