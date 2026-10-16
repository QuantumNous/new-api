import type { NextFetchEvent, NextRequest } from 'next/server';
import { kasadaHandler } from './kasada/kasada-server';

export async function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (req.method === 'POST') {
    if (process.env.NODE_ENV === 'development') {
      return undefined;
    }
    return kasadaHandler(req, ev);
  }
}

export const config = { matcher: ['/api/chat'] };
