// image-relay Cloudflare Worker
// Proxies /v1/* to an upstream Responses-API gateway; rewrites base64 image
// fields (both non-streaming JSON and streaming SSE) into public URLs served
// from IMAGE_BASE (e.g. an R2 custom domain).
//
// Bindings (env):
//   IMAGES        R2 bucket binding (required)
//   IMAGE_BASE    string, e.g. "https://cdn.opwan.ai" (required to rewrite)
//   RELAY_KEY     string, required Bearer token for /v1/* (optional)
//   UPSTREAM_KEY  string, real upstream key swapped in before forwarding (optional)
//   UPSTREAM_URL  string, override hardcoded upstream (optional; defaults to xixiapi.cc)

const UPSTREAM = 'https://xixiapi.cc';

function getUpstream(env) {
  return (env?.UPSTREAM_URL || UPSTREAM).replace(/\/$/, '');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/img/')) {
      return serveImage(url.pathname.slice(5), env);
    }

    if (url.pathname === '/healthz') {
      return new Response('image-relay: ok\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    if (url.pathname === '/') {
      return rootInfo(env);
    }

    if (url.pathname.startsWith('/v1/')) {
      const authError = checkAuth(request, env);
      if (authError) return authError;

      // Adapter: classic Images API → Responses API upstream
      if (
        request.method === 'POST' &&
        url.pathname === '/v1/images/generations'
      ) {
        return handleImagesGenerations(request, env);
      }
      if (
        request.method === 'POST' &&
        url.pathname === '/v1/images/edits'
      ) {
        return handleImagesEdits(request, env);
      }

      // Self-healing: if a caller (e.g. new-api) sends an image-generation
      // model through /v1/chat/completions, transparently route it through
      // the image pipeline instead of letting it fall through to the upstream
      // chat endpoint (which doesn't support image models).
      if (
        request.method === 'POST' &&
        url.pathname === '/v1/chat/completions'
      ) {
        const bodyText = await request.text();
        let parsed = null;
        try { parsed = JSON.parse(bodyText); } catch {}
        if (parsed && isImageModel(parsed.model)) {
          return handleChatCompletionsAsImage(parsed, request, env);
        }
        // Not an image model — reconstruct request and passthrough.
        const passReq = new Request(request, { body: bodyText });
        return proxyAndMaybeRewrite(passReq, url, env, ctx);
      }

      return proxyAndMaybeRewrite(request, url, env, ctx);
    }

    return new Response('not found\n', { status: 404 });
  },
};

function rootInfo(env) {
  const info = {
    service: 'image-relay',
    upstream: getUpstream(env),
    image_base: env.IMAGE_BASE || null,
    auth_required: Boolean(env.RELAY_KEY),
    endpoints: {
      health: 'GET /healthz',
      proxy: 'POST /v1/responses  (Authorization: Bearer <RELAY_KEY>)',
      images_fallback: 'GET /img/<key>  (only when IMAGE_BASE is unset)',
    },
  };
  return new Response(JSON.stringify(info, null, 2) + '\n', {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function checkAuth(request, env) {
  if (!env.RELAY_KEY) return null;
  const auth = request.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '').trim();
  if (provided !== env.RELAY_KEY) {
    console.error('auth: invalid relay key');
    return new Response(
      JSON.stringify({
        error: {
          message: 'Invalid relay key',
          type: 'authentication_error',
        },
      }),
      {
        status: 401,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
        },
      }
    );
  }
  return null;
}

async function serveImage(key, env) {
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('not found\n', { status: 404 });
  const headers = new Headers();
  headers.set(
    'content-type',
    obj.httpMetadata?.contentType || 'application/octet-stream'
  );
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers });
}

async function proxyAndMaybeRewrite(request, url, env, ctx) {
  const upstreamUrl = getUpstream(env) + url.pathname + url.search;
  const upstreamHeaders = new Headers(request.headers);

  // Swap the relay key for the real upstream key (when configured)
  if (env.UPSTREAM_KEY) {
    upstreamHeaders.set('authorization', `Bearer ${env.UPSTREAM_KEY}`);
  }

  // Strip CF-injected hop headers so upstream sees a clean request
  for (const h of [
    'cf-connecting-ip',
    'cf-ipcountry',
    'cf-ray',
    'cf-visitor',
    'cf-ew-via',
    'x-forwarded-for',
    'x-real-ip',
  ]) {
    upstreamHeaders.delete(h);
  }

  // Buffer the request body upfront so retries can resend it (a one-shot
  // ReadableStream cannot be replayed). Body for /v1/* is small JSON, so
  // buffering is cheap.
  let bodyBuffer = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      bodyBuffer = await request.arrayBuffer();
    } catch {
      bodyBuffer = null;
    }
  }

  // For POST /v1/responses with image_generation tool(s), inject default
  // moderation:"low" if the client didn't set it explicitly.
  const isResponsesPost =
    request.method === 'POST' && url.pathname === '/v1/responses';

  if (isResponsesPost && bodyBuffer) {
    bodyBuffer = injectImageModerationDefault(bodyBuffer);
  }

  // For non-streaming /v1/responses calls that include an image_generation
  // tool, force the upstream call into SSE and aggregate. Image generation
  // routinely takes 60-180s and would otherwise hit CF's 100s subrequest
  // timeout, returning 524 to the client.
  if (isResponsesPost && bodyBuffer) {
    let parsed = null;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bodyBuffer));
    } catch {}

    // URL → data:URI fallback. Many SDKs / users pass an http(s) URL for
    // input_image.image_url, but several upstream Responses-API providers
    // only accept inline base64. Inline before forwarding so the client
    // doesn't have to know which upstream is configured. Re-encode bodyBuffer
    // when any URL is inlined so the streaming-passthrough path also sees it.
    if (parsed) {
      try {
        const { inlined } = await inlineInputImageUrls(parsed);
        if (inlined > 0) {
          bodyBuffer = new TextEncoder().encode(JSON.stringify(parsed)).buffer;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const sep = msg.lastIndexOf('|');
        const status = sep >= 0 ? parseInt(msg.slice(sep + 1), 10) || 400 : 400;
        const text = sep >= 0 ? msg.slice(0, sep) : msg;
        return jsonError(status, `input_image url inline failed: ${text}`);
      }
    }

    const hasImageTool =
      parsed && Array.isArray(parsed.tools) &&
      parsed.tools.some((t) => t && t.type === 'image_generation');
    const clientWantsStream = parsed?.stream === true;
    if (hasImageTool && !clientWantsStream) {
      const result = await postResponsesAggregated(upstreamUrl, upstreamHeaders, parsed, env);
      if (result.ok) {
        return new Response(JSON.stringify(result.response), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
            'x-relay-mode': 'aggregated',
          },
        });
      }
      if (result.errorPayload) {
        return new Response(JSON.stringify({ error: result.errorPayload }), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
            'x-relay-mode': 'aggregated-error',
          },
        });
      }
      return new Response(result.rawBody, {
        status: result.status,
        headers: {
          'content-type': result.contentType,
          'access-control-allow-origin': '*',
        },
      });
    }
  }

  const upstreamResp = await fetchWithFastFailRetry(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body: bodyBuffer,
  });
  const ct = (upstreamResp.headers.get('content-type') || '').toLowerCase();

  if (isResponsesPost && upstreamResp.ok) {
    if (ct.includes('text/event-stream')) {
      return rewriteSSE(upstreamResp, env, ctx);
    }
    if (ct.includes('application/json')) {
      return rewriteJsonResponse(upstreamResp, url, env);
    }
  }

  // Pass-through: errors, /v1/images/*, anything that's not /v1/responses JSON
  const passHeaders = new Headers(upstreamResp.headers);
  passHeaders.set('access-control-allow-origin', '*');
  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    headers: passHeaders,
  });
}

async function rewriteJsonResponse(upstreamResp, url, env) {
  const data = await upstreamResp.json();
  // If IMAGE_BASE is bound (e.g. R2 custom domain), use it. Otherwise serve
  // from this Worker's own /img/* path.
  const imageBase = (env.IMAGE_BASE || `${url.protocol}//${url.host}/img`).replace(/\/$/, '');
  let rewritten = 0;

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (
        item &&
        item.type === 'image_generation_call' &&
        typeof item.result === 'string' &&
        item.result.length > 100
      ) {
        const ext = inferExt(item.output_format, item.result);
        const key = await uploadToR2(item.result, ext, env);
        item.result = `${imageBase}/${key}`;
        if (item.status === 'generating') item.status = 'completed';
        rewritten++;
      }
    }
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'x-relay-rewritten-count': String(rewritten),
    },
  });
}

async function uploadToR2(b64, ext, env) {
  const binary = await base64ToBytes(b64);
  const hash = await sha256Hex(binary);
  const key = `images/${hash}.${ext}`;
  const existing = await env.IMAGES.head(key);
  if (!existing) {
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    await env.IMAGES.put(key, binary, {
      httpMetadata: { contentType: mime },
    });
  }
  return key;
}

function inferExt(claimed, b64) {
  const c = (claimed || '').toLowerCase();
  if (c === 'jpeg' || c === 'jpg') return 'jpg';
  if (c === 'png') return 'png';
  if (c === 'webp') return 'webp';
  const head = b64.slice(0, 8);
  if (head.startsWith('iVBOR')) return 'png';
  if (head.startsWith('/9j/')) return 'jpg';
  if (head.startsWith('UklG')) return 'webp';
  if (head.startsWith('R0lGOD')) return 'gif';
  return 'png';
}

// Yields control back to the runtime. Workers' isolate has a hidden ~2s
// synchronous-CPU ceiling; any unbroken JS loop past it is killed with
// `exceededCpu`. Yielding between chunks resets that window so a multi-MB
// base64 decode can run within the 30s per-request CPU budget.
const yieldNow = () =>
  typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function'
    ? scheduler.yield()
    : new Promise((r) => setTimeout(r, 0));

const BASE64_CHUNK = 1 << 18; // 256 KiB per yield

async function base64ToBytes(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let off = 0; off < len; off += BASE64_CHUNK) {
    const end = Math.min(off + BASE64_CHUNK, len);
    for (let i = off; i < end; i++) arr[i] = bin.charCodeAt(i);
    if (end < len) await yieldNow();
  }
  return arr;
}

async function sha256Hex(buf) {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Limits for inline-image inputs. CF Workers have a 128MB CPU/memory budget
// per request; 25MB matches OpenAI's per-image cap, and 16 matches their
// images-edits batch limit.
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES_PER_REQUEST = 16;
const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

function pickMimeFromType(rawType) {
  const t = (rawType || '').toLowerCase();
  if (t.includes('webp')) return 'image/webp';
  if (t.includes('jpeg') || t.includes('jpg')) return 'image/jpeg';
  if (t.includes('png')) return 'image/png';
  return null;
}

// Resolves an image input — File/Blob, http(s) URL string, or pre-formed
// data: URI — into a data:image/<mime>;base64,... string. Validates type and
// caps size at MAX_IMAGE_BYTES. Returns { dataUri, mime } on success, throws
// Error('msg|status') where status is the HTTP status to surface.
async function normalizeImageInput(value) {
  // Pre-formed data URI: validate prefix and pass through unchanged.
  if (typeof value === 'string' && value.startsWith('data:')) {
    const m = /^data:(image\/(?:png|jpeg|webp))(?:;[^,]*)?,/i.exec(value);
    if (!m) throw new Error('image data URI must be image/png|jpeg|webp|400');
    return { dataUri: value, mime: m[1].toLowerCase() };
  }

  // http(s) URL: fetch, validate, base64-encode.
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    let resp;
    try {
      resp = await fetch(value, {
        method: 'GET',
        redirect: 'follow',
        cf: { cacheEverything: false },
      });
    } catch (e) {
      throw new Error(`failed to fetch image url: ${e instanceof Error ? e.message : String(e)}|400`);
    }
    if (!resp.ok) {
      throw new Error(`image url returned ${resp.status}|400`);
    }
    const declaredType = resp.headers.get('content-type') || '';
    const declaredLen = parseInt(resp.headers.get('content-length') || '0', 10);
    if (declaredLen && declaredLen > MAX_IMAGE_BYTES) {
      throw new Error(`image url too large: ${declaredLen} bytes (max ${MAX_IMAGE_BYTES})|400`);
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new Error(`image url too large: ${buf.length} bytes (max ${MAX_IMAGE_BYTES})|400`);
    }
    let mime = pickMimeFromType(declaredType);
    if (!mime) {
      const headB64 = await bytesToBase64(buf.subarray(0, 12));
      mime = pickMimeFromType('image/' + (inferExt('', headB64) || ''));
    }
    if (!mime) {
      throw new Error(`image url content-type unsupported: "${declaredType}"|400`);
    }
    return { dataUri: `data:${mime};base64,${await bytesToBase64(buf)}`, mime };
  }

  // File / Blob from multipart.
  if (value && typeof value === 'object' && typeof value.arrayBuffer === 'function') {
    const mime = pickMimeFromType(value.type);
    if (!mime) {
      throw new Error(`unsupported image type "${value.type || 'unknown'}", use png, jpeg, or webp|400`);
    }
    const buf = new Uint8Array(await value.arrayBuffer());
    if (buf.length === 0) throw new Error('empty image file|400');
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new Error(`image too large: ${buf.length} bytes (max ${MAX_IMAGE_BYTES})|400`);
    }
    return { dataUri: `data:${mime};base64,${await bytesToBase64(buf)}`, mime };
  }

  throw new Error('image input must be a file, http(s) URL, or data: URI|400');
}

// Collects all image-like form fields used by the OpenAI Images-Edits API.
// Supports three idioms used by SDKs in the wild:
//   - repeated 'image' fields (canonical)
//   - 'image[]' suffix (some Python SDKs)
//   - 'image[0]', 'image[1]', ... numbered (some JS SDKs)
function collectImageFields(formData) {
  const out = [];
  for (const v of formData.getAll('image')) out.push(v);
  for (const v of formData.getAll('image[]')) out.push(v);
  // Numbered: image[0], image[1], ...
  const numbered = [];
  for (const [k, v] of formData.entries()) {
    const m = /^image\[(\d+)\]$/.exec(k);
    if (m) numbered.push({ idx: parseInt(m[1], 10), v });
  }
  numbered.sort((a, b) => a.idx - b.idx);
  for (const n of numbered) out.push(n.v);
  // Drop empty / blank-string entries.
  return out.filter(
    (v) => v !== null && v !== undefined && v !== '' && v !== 'undefined'
  );
}

// Walks a /v1/responses request body and inlines any input_image.image_url
// that points at an http(s) URL. Returns the same object (mutated) plus the
// number of URLs that were inlined (for diagnostics). Errors propagate.
async function inlineInputImageUrls(body) {
  if (!body || !Array.isArray(body.input)) return { body, inlined: 0 };
  let inlined = 0;
  for (const item of body.input) {
    if (!item || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (
        part &&
        part.type === 'input_image' &&
        typeof part.image_url === 'string' &&
        /^https?:\/\//i.test(part.image_url)
      ) {
        const { dataUri } = await normalizeImageInput(part.image_url);
        part.image_url = dataUri;
        inlined++;
      }
    }
  }
  return { body, inlined };
}

// Forces stream:true on a /v1/responses POST body, consumes the upstream SSE
// in this worker, and returns a single aggregated JSON response object
// (mirroring what upstream would have sent for a non-streaming call).
//
// Why: image-generation calls routinely take 60-180s. CF subrequests have a
// 100s read timeout, so non-streaming POSTs to slow upstreams reliably 524.
// SSE streams keep the connection alive via incremental events and dodge the
// timeout, then we reassemble.
//
// Side effects: same R2 uploads as rewriteSSE / rewriteJsonResponse — base64
// image_generation_call.result is rewritten to a CDN URL inline.
async function postResponsesAggregated(upstreamUrl, headers, parsedBody, env) {
  const merged = { ...parsedBody, stream: true };
  const upstreamResp = await fetchWithFastFailRetry(upstreamUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(merged),
  });

  if (!upstreamResp.ok) {
    const errBody = await upstreamResp.text();
    return {
      ok: false,
      status: upstreamResp.status,
      contentType: upstreamResp.headers.get('content-type') || 'text/plain',
      rawBody: errBody,
    };
  }

  const ct = (upstreamResp.headers.get('content-type') || '').toLowerCase();
  const imageBase = (env.IMAGE_BASE || '').replace(/\/$/, '');

  // Upstream ignored stream:true and gave back JSON anyway — handle as before.
  if (!ct.includes('text/event-stream')) {
    const data = await upstreamResp.json();
    if (imageBase && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (
          item?.type === 'image_generation_call' &&
          typeof item.result === 'string' &&
          item.result.length > 100
        ) {
          const ext = inferExt(item.output_format, item.result);
          const key = await uploadToR2(item.result, ext, env);
          item.result = `${imageBase}/${key}`;
          if (item.status === 'generating') item.status = 'completed';
        }
      }
    }
    return { ok: true, status: 200, response: data };
  }

  const decoder = new TextDecoder();
  const reader = upstreamResp.body.getReader();
  const state = { collectedItems: [] };
  let finalResponse = null;
  let errorPayload = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const eventText = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const consumed = await consumeAggregatedEvent(eventText, env, state, imageBase);
      if (consumed.finalResponse) finalResponse = consumed.finalResponse;
      if (consumed.error) errorPayload = consumed.error;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim().length > 0) {
    const consumed = await consumeAggregatedEvent(buffer, env, state, imageBase);
    if (consumed.finalResponse) finalResponse = consumed.finalResponse;
    if (consumed.error) errorPayload = consumed.error;
  }

  if (finalResponse) {
    return { ok: true, status: 200, response: finalResponse };
  }
  if (errorPayload) {
    return { ok: false, status: 200, errorPayload };
  }
  return {
    ok: false,
    status: 502,
    errorPayload: { message: 'upstream stream ended without response.completed', type: 'upstream_error' },
  };
}

// Parses one SSE event from an aggregated upstream stream. Tracks
// image_generation_call items as they complete (so a final
// response.completed with output:[] can be backfilled), uploads their base64
// payload to R2, and surfaces any terminal error event.
async function consumeAggregatedEvent(eventText, env, state, imageBase) {
  const lines = eventText.split('\n');
  let dataIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('data: ')) { dataIdx = i; break; }
  }
  if (dataIdx < 0) return {};
  const dataStr = lines[dataIdx].slice(6);
  let obj;
  try { obj = JSON.parse(dataStr); } catch { return {}; }

  // Skip preview frames; only the terminal item carries the canonical result.
  if (obj.type === 'response.image_generation_call.partial_image') return {};

  if (
    obj.type === 'response.output_item.done' &&
    obj.item?.type === 'image_generation_call'
  ) {
    if (
      typeof obj.item.result === 'string' &&
      obj.item.result.length > 100 &&
      imageBase
    ) {
      const ext = inferExt(obj.item.output_format, obj.item.result);
      const key = await uploadToR2(obj.item.result, ext, env);
      obj.item.result = `${imageBase}/${key}`;
      if (obj.item.status === 'generating') obj.item.status = 'completed';
    }
    state.collectedItems.push(JSON.parse(JSON.stringify(obj.item)));
    return {};
  }

  if (obj.type === 'response.completed' && obj.response) {
    const resp = obj.response;
    if (Array.isArray(resp.output)) {
      for (const item of resp.output) {
        if (
          item?.type === 'image_generation_call' &&
          typeof item.result === 'string' &&
          item.result.length > 100 &&
          imageBase
        ) {
          const ext = inferExt(item.output_format, item.result);
          const key = await uploadToR2(item.result, ext, env);
          item.result = `${imageBase}/${key}`;
          if (item.status === 'generating') item.status = 'completed';
        }
      }
      if (resp.output.length === 0 && state.collectedItems.length > 0) {
        resp.output = state.collectedItems.slice();
      }
    }
    return { finalResponse: resp };
  }

  if (obj.type === 'response.failed' || obj.type === 'response.incomplete') {
    return {
      error:
        obj.response?.error ||
        { message: `upstream ${obj.type}`, type: obj.type },
    };
  }
  if (obj.type === 'error') {
    return { error: obj.error || { message: 'upstream error', type: 'error' } };
  }
  return {};
}

// Wraps fetch with fast-fail retry. Only retries on 502/503/504 that come back
// quickly (< fastFailMs) — those are upstream gateway-layer rejects (rate
// limit, transient overload) where the upstream model never started running,
// so re-issuing is safe and cheap. Slow failures (model already burned cycles)
// are returned as-is to avoid double-charging compute.
//
// init.body MUST be a re-readable value (string / Uint8Array / FormData), not
// a one-shot ReadableStream, otherwise the retry attempt sends an empty body.
async function fetchWithFastFailRetry(url, init, opts) {
  const FAST_FAIL_MS = opts?.fastFailMs ?? 10000;
  const MAX_ATTEMPTS = opts?.maxAttempts ?? 3;
  const RETRY_STATUSES = opts?.retryStatuses ?? new Set([502, 503, 504]);

  let lastResp;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = Date.now();
    lastResp = await fetch(url, init);
    const elapsed = Date.now() - start;

    if (lastResp.ok) return lastResp;
    if (!RETRY_STATUSES.has(lastResp.status)) return lastResp;
    if (elapsed >= FAST_FAIL_MS) return lastResp;
    if (attempt === MAX_ATTEMPTS) return lastResp;

    // Drain body so the connection can be reused
    try { await lastResp.body?.cancel(); } catch {}

    const backoffMs = 300 * attempt;
    console.error(
      `retry ${attempt + 1}/${MAX_ATTEMPTS} after fast fail status=${lastResp.status} elapsed=${elapsed}ms`
    );
    await new Promise((r) => setTimeout(r, backoffMs));
  }
  return lastResp;
}

// ---- Classic /v1/images/generations adapter -------------------------------
//
// Translates classic OpenAI Images-API requests into the Responses-API shape
// upstream, then re-shapes the upstream output back into the classic
// `{created, data: [{url|b64_json}]}` envelope so existing OpenAI SDK clients
// (and new-api's image-generation billing path) work unchanged.

// Detects model names that should be routed through the image pipeline,
// even when the caller arrives via /v1/chat/completions.
function isImageModel(model) {
  if (!model || typeof model !== 'string') return false;
  const m = model.toLowerCase();
  return (
    m.startsWith('gpt-image') ||
    m.startsWith('dall-e') ||
    m.startsWith('flux') ||
    m.startsWith('sd-') ||
    m.startsWith('stable-') ||
    m.includes('-image-') ||
    m.endsWith('-image')
  );
}

function extractPromptFromMessages(messages) {
  if (!Array.isArray(messages)) return '';
  // Take the last user message; fall back to concatenation of all user texts.
  const userMsgs = messages.filter((m) => m && m.role === 'user');
  const target = userMsgs.length ? userMsgs[userMsgs.length - 1] : messages[messages.length - 1];
  if (!target) return '';
  if (typeof target.content === 'string') return target.content;
  if (Array.isArray(target.content)) {
    return target.content
      .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join(' ');
  }
  return '';
}

// Bridges /v1/chat/completions → image pipeline → chat.completion envelope.
// The assistant message content embeds the generated image as a Markdown
// image link (most chat UIs render it natively). When the original request
// asked for stream:true, the response is delivered as a minimal SSE stream
// so streaming clients don't break.
async function handleChatCompletionsAsImage(reqBody, originalRequest, env) {
  const prompt = extractPromptFromMessages(reqBody.messages);
  if (!prompt) {
    return jsonError(400, 'no user prompt found in messages');
  }

  // Forge an Images API request and reuse the existing handler.
  const imageReq = {
    model: reqBody.model,
    prompt,
    size: reqBody.size || '1024x1024',
    output_format: reqBody.output_format || 'jpeg',
    output_compression:
      reqBody.output_compression !== undefined ? reqBody.output_compression : 85,
    response_format: 'url',
  };
  if (reqBody.background) imageReq.background = reqBody.background;
  if (reqBody.quality) imageReq.quality = reqBody.quality;
  if (reqBody.moderation) imageReq.moderation = reqBody.moderation;

  const syntheticRequest = new Request(originalRequest.url, {
    method: 'POST',
    headers: originalRequest.headers,
    body: JSON.stringify(imageReq),
  });

  const imageResp = await handleImagesGenerations(syntheticRequest, env);

  if (!imageResp.ok) {
    // Pass through upstream error as-is.
    return imageResp;
  }

  let imageJson;
  try {
    imageJson = await imageResp.json();
  } catch {
    return jsonError(502, 'image handler returned non-json');
  }

  const first = (imageJson.data && imageJson.data[0]) || {};
  const url = typeof first.url === 'string' ? first.url : '';
  const b64 = typeof first.b64_json === 'string' ? first.b64_json : '';
  const revised = typeof first.revised_prompt === 'string' ? first.revised_prompt : '';

  let content = '';
  if (url) {
    content = `![image](${url})`;
  } else if (b64) {
    const ext = inferExt(imageJson.output_format, b64);
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    content = `![image](data:${mime};base64,${b64})`;
  } else {
    content = '(image generation produced no result)';
  }
  if (revised) {
    content = content + `\n\n_Revised prompt: ${revised}_`;
  }

  const chatId = 'chatcmpl-' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36));
  const created = Math.floor(Date.now() / 1000);
  const model = imageJson.model || reqBody.model;

  const usage = imageJson.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // Streaming clients: emit a tiny SSE sequence (role / content / stop / DONE).
  if (reqBody.stream) {
    const enc = new TextEncoder();
    const body =
      sseChunk({
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      }) +
      sseChunk({
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: { content }, finish_reason: null }],
      }) +
      sseChunk({
        id: chatId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      }) +
      'data: [DONE]\n\n';
    return new Response(enc.encode(body), {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'access-control-allow-origin': '*',
        'x-relay-mode': 'chat-as-image-sse',
      },
    });
  }

  const chatResp = {
    id: chatId,
    object: 'chat.completion',
    created,
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage,
  };

  return new Response(JSON.stringify(chatResp), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'x-relay-mode': 'chat-as-image',
    },
  });
}

function sseChunk(obj) {
  return 'data: ' + JSON.stringify(obj) + '\n\n';
}

// Walks a JSON request body and ensures every image_generation tool has
// moderation set; defaults to "low". Returns a new ArrayBuffer if mutated,
// otherwise returns the input untouched.
function injectImageModerationDefault(bodyBuffer) {
  try {
    const text = new TextDecoder().decode(bodyBuffer);
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.tools)) return bodyBuffer;
    let mutated = false;
    for (const t of obj.tools) {
      if (t && t.type === 'image_generation' && !t.moderation) {
        t.moderation = 'low';
        mutated = true;
      }
    }
    if (!mutated) return bodyBuffer;
    return new TextEncoder().encode(JSON.stringify(obj)).buffer;
  } catch {
    return bodyBuffer;
  }
}

function jsonError(status, message) {
  return new Response(
    JSON.stringify({ error: { message, type: 'invalid_request_error' } }),
    {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      },
    }
  );
}

async function handleImagesGenerations(request, env) {
  let reqBody;
  try {
    reqBody = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  // Map classic params → image_generation tool config (only forward set fields)
  const tool = { type: 'image_generation' };
  if (reqBody.size) tool.size = reqBody.size;
  if (reqBody.quality) tool.quality = reqBody.quality;
  if (reqBody.output_format) tool.output_format = reqBody.output_format;
  if (reqBody.output_compression !== undefined) {
    tool.output_compression = reqBody.output_compression;
  }
  if (reqBody.background) tool.background = reqBody.background;
  // Default moderation to "low" for the lowest false-positive rate; client can
  // still override by passing moderation explicitly.
  tool.moderation = reqBody.moderation || 'low';

  const responsesBody = {
    model: reqBody.model || 'gpt-image-2',
    input: reqBody.prompt ?? reqBody.input ?? '',
    tools: [tool],
  };

  const upstreamHeaders = new Headers();
  upstreamHeaders.set('content-type', 'application/json');
  if (env.UPSTREAM_KEY) {
    upstreamHeaders.set('authorization', `Bearer ${env.UPSTREAM_KEY}`);
  } else {
    const incoming = request.headers.get('authorization');
    if (incoming) upstreamHeaders.set('authorization', incoming);
  }

  const aggregated = await postResponsesAggregated(
    getUpstream(env) + '/v1/responses',
    upstreamHeaders,
    responsesBody,
    env
  );

  if (!aggregated.ok) {
    if (aggregated.errorPayload) {
      console.error(
        `images/generations upstream error: ${JSON.stringify(aggregated.errorPayload).slice(0, 300)}`
      );
      return new Response(JSON.stringify({ error: aggregated.errorPayload }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
        },
      });
    }
    console.error(
      `images/generations upstream ${aggregated.status}: ${(aggregated.rawBody || '').slice(0, 200)}`
    );
    return new Response(aggregated.rawBody || '', {
      status: aggregated.status,
      headers: {
        'content-type': aggregated.contentType || 'text/plain',
        'access-control-allow-origin': '*',
      },
    });
  }

  const responsesData = aggregated.response;
  const imageBase = (env.IMAGE_BASE || '').replace(/\/$/, '');
  const wantB64 = reqBody.response_format === 'b64_json';
  const originalPrompt = String(reqBody.prompt ?? reqBody.input ?? '');

  const data = [];
  let firstFormat;
  let firstSize;
  for (const item of responsesData.output || []) {
    if (
      item?.type === 'image_generation_call' &&
      typeof item.result === 'string' &&
      item.result.length > 0
    ) {
      if (!firstFormat) firstFormat = item.output_format;
      if (!firstSize) firstSize = item.size;
      const entry = {};
      // After aggregation, item.result is already a CDN URL (R2-uploaded by
      // postResponsesAggregated). For wantB64 mode we'd need the raw base64,
      // which has been replaced — fall back to returning the URL instead.
      const looksLikeUrl = /^https?:\/\//i.test(item.result);
      if (wantB64 && !looksLikeUrl) {
        entry.b64_json = item.result;
      } else if (looksLikeUrl) {
        entry.url = item.result;
      } else {
        const ext = inferExt(item.output_format, item.result);
        entry.url = imageBase
          ? `${imageBase}/${ext}`
          : `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${item.result}`;
      }
      const revised =
        (typeof item.revised_prompt === 'string' && item.revised_prompt) ||
        extractMessageText(responsesData) ||
        originalPrompt;
      if (revised) entry.revised_prompt = revised;
      data.push(entry);
    }
  }

  const out = {
    created: Math.floor(Date.now() / 1000),
    data,
    background: responsesData.background || reqBody.background || 'auto',
    output_format: reqBody.output_format || firstFormat || 'png',
    quality: reqBody.quality || 'auto',
    size: reqBody.size || firstSize || '1024x1024',
    usage: responsesData.usage,
    model: responsesData.model || reqBody.model,
  };

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'x-relay-mode': 'images-via-responses',
      'x-relay-rewritten-count': String(data.length),
    },
  });
}

// ---- Classic /v1/images/edits adapter -------------------------------------
//
// Translates classic OpenAI Images-Edits requests (multipart/form-data with
// an image file and a text prompt) into the Responses-API multimodal shape
// upstream, then re-shapes the response back into the classic Images-API
// envelope.

async function handleImagesEdits(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, 'Invalid multipart/form-data body');
  }

  const imageFields = collectImageFields(formData);
  const prompt = formData.get('prompt');
  if (imageFields.length === 0) {
    return jsonError(400, '"image" field is required (file, http(s) URL, or data: URI)');
  }
  if (imageFields.length > MAX_IMAGES_PER_REQUEST) {
    return jsonError(
      400,
      `too many images: ${imageFields.length} (max ${MAX_IMAGES_PER_REQUEST})`
    );
  }
  if (!prompt || typeof prompt !== 'string') {
    return jsonError(400, '"prompt" field is required');
  }

  // Normalize all images in parallel; surface the first failing one.
  let imageDataUris;
  try {
    imageDataUris = await Promise.all(imageFields.map((v) => normalizeImageInput(v)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const sep = msg.lastIndexOf('|');
    const status = sep >= 0 ? parseInt(msg.slice(sep + 1), 10) || 400 : 400;
    const text = sep >= 0 ? msg.slice(0, sep) : msg;
    return jsonError(status, text);
  }

  const model = String(formData.get('model') || 'gpt-image-2');
  const size = formData.get('size');
  const quality = formData.get('quality');
  const outputFormat = formData.get('output_format');
  const outputCompression = formData.get('output_compression');
  const background = formData.get('background');
  const moderation = formData.get('moderation');
  const responseFormat = formData.get('response_format');

  // Build /v1/responses tool config from form fields
  const tool = { type: 'image_generation' };
  if (size) tool.size = String(size);
  if (quality) tool.quality = String(quality);
  if (outputFormat) tool.output_format = String(outputFormat);
  if (
    outputCompression !== null &&
    outputCompression !== undefined &&
    outputCompression !== ''
  ) {
    const n = parseInt(String(outputCompression), 10);
    if (!Number.isNaN(n)) tool.output_compression = n;
  }
  if (background) tool.background = String(background);
  // Default moderation to "low" for the lowest false-positive rate.
  tool.moderation = moderation ? String(moderation) : 'low';

  const userContent = [{ type: 'input_text', text: String(prompt) }];
  for (const { dataUri } of imageDataUris) {
    userContent.push({ type: 'input_image', image_url: dataUri });
  }
  const responsesBody = {
    model,
    input: [{ role: 'user', content: userContent }],
    tools: [tool],
  };

  const upstreamHeaders = new Headers();
  upstreamHeaders.set('content-type', 'application/json');
  if (env.UPSTREAM_KEY) {
    upstreamHeaders.set('authorization', `Bearer ${env.UPSTREAM_KEY}`);
  } else {
    const incoming = request.headers.get('authorization');
    if (incoming) upstreamHeaders.set('authorization', incoming);
  }

  const aggregated = await postResponsesAggregated(
    getUpstream(env) + '/v1/responses',
    upstreamHeaders,
    responsesBody,
    env
  );

  if (!aggregated.ok) {
    if (aggregated.errorPayload) {
      console.error(
        `images/edits upstream error: ${JSON.stringify(aggregated.errorPayload).slice(0, 300)}`
      );
      return new Response(JSON.stringify({ error: aggregated.errorPayload }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
        },
      });
    }
    console.error(
      `images/edits upstream ${aggregated.status}: ${(aggregated.rawBody || '').slice(0, 200)}`
    );
    return new Response(aggregated.rawBody || '', {
      status: aggregated.status,
      headers: {
        'content-type': aggregated.contentType || 'text/plain',
        'access-control-allow-origin': '*',
      },
    });
  }

  const responsesData = aggregated.response;
  const imageBase = (env.IMAGE_BASE || '').replace(/\/$/, '');
  const wantB64 = responseFormat === 'b64_json';
  const originalPrompt = String(prompt);

  const data = [];
  let firstFormat;
  let firstSize;
  for (const item of responsesData.output || []) {
    if (
      item?.type === 'image_generation_call' &&
      typeof item.result === 'string' &&
      item.result.length > 0
    ) {
      if (!firstFormat) firstFormat = item.output_format;
      if (!firstSize) firstSize = item.size;
      const entry = {};
      const looksLikeUrl = /^https?:\/\//i.test(item.result);
      if (wantB64 && !looksLikeUrl) {
        entry.b64_json = item.result;
      } else if (looksLikeUrl) {
        entry.url = item.result;
      } else {
        const ext = inferExt(item.output_format, item.result);
        entry.url = imageBase
          ? `${imageBase}/${ext}`
          : `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${item.result}`;
      }
      const revised =
        (typeof item.revised_prompt === 'string' && item.revised_prompt) ||
        extractMessageText(responsesData) ||
        originalPrompt;
      if (revised) entry.revised_prompt = revised;
      data.push(entry);
    }
  }

  const out = {
    created: Math.floor(Date.now() / 1000),
    data,
    background: responsesData.background || (background ? String(background) : 'auto'),
    output_format: outputFormat ? String(outputFormat) : firstFormat || 'png',
    quality: quality ? String(quality) : 'auto',
    size: size ? String(size) : firstSize || '1024x1024',
    usage: responsesData.usage,
    model: responsesData.model || model,
  };

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'x-relay-mode': 'edits-via-responses',
      'x-relay-rewritten-count': String(data.length),
    },
  });
}

async function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;          // 32 KiB per fromCharCode.apply call
  const yieldEvery = 64;          // yield every ~2 MiB of input
  let sinceYield = 0;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    if (++sinceYield >= yieldEvery && i + chunk < bytes.length) {
      sinceYield = 0;
      await yieldNow();
    }
  }
  return btoa(bin);
}

// Pulls the first non-empty `output_text` from any message item in a
// /v1/responses payload. Used as one of the fallbacks for revised_prompt
// when adapting back to the classic Images API envelope.
function extractMessageText(responsesData) {
  for (const item of responsesData.output || []) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (
          part?.type === 'output_text' &&
          typeof part.text === 'string' &&
          part.text.length > 0
        ) {
          return part.text;
        }
      }
    }
  }
  return '';
}

// ---- SSE rewrite ----------------------------------------------------------
//
// For streaming /v1/responses (stream=true), parse the SSE event stream on
// the fly. Any event carrying base64 image data has its payload uploaded to
// R2 and the base64 field replaced with a public URL pointing to IMAGE_BASE.
// Other event types are forwarded unchanged.

function rewriteSSE(upstreamResp, env, ctx) {
  const { readable, writable } = new TransformStream();
  ctx.waitUntil(processSSEStream(upstreamResp.body, writable, env));
  const headers = new Headers();
  headers.set('content-type', 'text/event-stream; charset=utf-8');
  headers.set('cache-control', 'no-cache, no-transform');
  headers.set('connection', 'keep-alive');
  headers.set('access-control-allow-origin', '*');
  headers.set('x-relay-mode', 'sse');
  return new Response(readable, { status: 200, headers });
}

async function processSSEStream(upstreamBody, writable, env) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstreamBody.getReader();
  const writer = writable.getWriter();

  // Per-request state: image_generation_call items completed so far. Used to
  // refill response.completed.response.output when upstream sends it empty.
  const state = { collectedItems: [] };

  let buffer = '';
  let modified = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const eventText = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const result = await processSSEEvent(eventText, env, state);
        if (result.changed) modified++;
        await writer.write(encoder.encode(result.text + '\n\n'));
      }
    }
    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const result = await processSSEEvent(buffer, env, state);
      await writer.write(encoder.encode(result.text));
    }
    if (modified > 0) console.log(`SSE: rewrote ${modified} event(s)`);
  } catch (e) {
    console.error('SSE rewrite error:', e instanceof Error ? e.message : String(e));
  } finally {
    try { await writer.close(); } catch {}
  }
}

async function processSSEEvent(eventText, env, state) {
  const lines = eventText.split('\n');
  let dataIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('data: ')) {
      dataIdx = i;
      break;
    }
  }
  if (dataIdx < 0) return { text: eventText, changed: false };

  const dataStr = lines[dataIdx].slice(6);
  let obj;
  try { obj = JSON.parse(dataStr); } catch { return { text: eventText, changed: false }; }

  const imageBase = (env.IMAGE_BASE || '').replace(/\/$/, '');
  if (!imageBase) return { text: eventText, changed: false };

  let changed = false;

  // partial_image — bulky preview frame
  if (
    obj.type === 'response.image_generation_call.partial_image' &&
    typeof obj.partial_image_b64 === 'string' &&
    obj.partial_image_b64.length > 100
  ) {
    const ext = inferExt(obj.output_format, obj.partial_image_b64);
    const key = await uploadToR2(obj.partial_image_b64, ext, env);
    obj.partial_image_url = `${imageBase}/${key}`;
    delete obj.partial_image_b64;
    changed = true;
  }

  // output_item.done — completed image (terminal frame)
  if (
    obj.type === 'response.output_item.done' &&
    obj.item?.type === 'image_generation_call' &&
    typeof obj.item.result === 'string' &&
    obj.item.result.length > 100
  ) {
    const ext = inferExt(obj.item.output_format, obj.item.result);
    const key = await uploadToR2(obj.item.result, ext, env);
    obj.item.result = `${imageBase}/${key}`;
    if (obj.item.status === 'generating') obj.item.status = 'completed';
    changed = true;
  }

  // Track completed image-generation items so we can refill response.completed
  // when upstream leaves response.output as []. Use a shallow clone to avoid
  // accidental mutation if the same item is touched again later.
  if (
    obj.type === 'response.output_item.done' &&
    obj.item?.type === 'image_generation_call' &&
    state &&
    Array.isArray(state.collectedItems)
  ) {
    state.collectedItems.push(JSON.parse(JSON.stringify(obj.item)));
  }

  // response.completed — rewrite any base64 still inside, fix status, and
  // refill response.output if upstream sent it empty.
  if (obj.type === 'response.completed' && obj.response) {
    if (Array.isArray(obj.response.output)) {
      for (const item of obj.response.output) {
        if (
          item?.type === 'image_generation_call' &&
          typeof item.result === 'string' &&
          item.result.length > 100
        ) {
          const ext = inferExt(item.output_format, item.result);
          const key = await uploadToR2(item.result, ext, env);
          item.result = `${imageBase}/${key}`;
          if (item.status === 'generating') item.status = 'completed';
          changed = true;
        }
      }
      if (
        obj.response.output.length === 0 &&
        state &&
        Array.isArray(state.collectedItems) &&
        state.collectedItems.length > 0
      ) {
        obj.response.output = state.collectedItems.slice();
        changed = true;
      }
    }
  }

  if (!changed) return { text: eventText, changed: false };
  lines[dataIdx] = 'data: ' + JSON.stringify(obj);
  return { text: lines.join('\n'), changed: true };
}
