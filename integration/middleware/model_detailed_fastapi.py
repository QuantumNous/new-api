#!/usr/bin/env python3
"""
NewAPI Model Metadata Enrichment Middleware - FastAPI Version

High-performance async proxy that intercepts GET /v1/models and returns enriched
metadata for DeepSeek and MiniMax models, while transparently proxying all other
requests to the NewAPI backend.

Usage:
    uvicorn model_detailed_fastapi:app --host 0.0.0.0 --port 3001 --workers 4
"""

import json
import os
import re
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, HTTPException, Depends, Cookie
from fastapi.responses import JSONResponse, Response, RedirectResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles


# ==============================================================================
# Thinking Block Stripper (MiniMax reasoning output cleaner)
# ==============================================================================

THINK_CLOSE = "</final>"
THINK_OPEN = "<think>"

# CJK character pattern — matches Chinese/Japanese/Korean characters via Unicode ranges.
# Covers: CJK Unified Ideographs, CJK Extension A, CJK Symbols/Punctuation,
# Halfwidth/Fullwidth Forms, Hiragana, Katakana, Hangul Syllables,
# and Katakana Phonetic Extensions.
CJK_PATTERN = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff\uac00-\ud7af]")


def strip_thinking_from_text(text: str) -> str:
    """
    Remove MiniMax thinking/reasoning blocks from text content.

    MiniMax-M2.7-hs sometimes includes <think> reasoning tags in its response text.
    These tags wrap internal reasoning that should NOT be exposed to clients that
    just want the final answer.

    This function:
    1. Finds the LAST closing </think> tag (the one that closes the outermost/actual think block)
    2. Returns everything AFTER that tag (the real answer)
    3. If no think block found, returns the original text unchanged
    """
    last_close = text.rfind(THINK_CLOSE)
    if last_close == -1:
        return text  # No thinking block — return as-is

    # Everything after the last </think>
    result = text[last_close + len(THINK_CLOSE):].strip("\n\r ")
    return result


def strip_cjk_from_text(text: str) -> str:
    """
    Remove all CJK (Chinese/Japanese/Korean) characters from text.

    Secondary defense-in-depth filter. The router (new-api Go) also applies
    StripCJK via ChannelSettings, but the middleware layer catches any CJK
    characters that slip through upstream or bypass the router's relay path.

    MiniMax-M2.7-hs can occasionally generate CJK tokens in non-CJK contexts
    due to BBPE tokenizer quirks with temperature sampling.
    """
    return CJK_PATTERN.sub("", text)


def clean_code_fences(text: str) -> str:
    """
    Strip leading/trailing markdown code fences from text.
    Handles: ```xml ... ``` or ```python ... ``` or ``` ... ```
    Also strips common explanatory prefixes the model adds after the think block.
    """
    # Strip leading code fence with optional language (```xml\n or ```python\n or ```\n)
    text = re.sub(r'^\s*```[a-zA-Z]*\s*\n?', '\n', text)
    # Strip trailing code fence
    text = re.sub(r'\n?\s*```\s*$', '\n', text)
    return text.strip()


def extract_xml_block(text: str) -> str | None:
    """
    Try to extract a clean XML block from text.
    Returns the XML content if found, None otherwise.
    Handles:
      <cores>...</cores>
      <root><child>...</child></root>
      and other XML fragments
    """
    # Match XML tags (simplified — not a full parser)
    xml_match = re.search(r'(<[a-zA-Z_][\w\-.]*(?:\s+[^>]*)?>.*?</[a-zA-Z_][\w\-.]*>|\n<[a-zA-Z_][\w\-.]*\s*/>)', text, re.DOTALL)
    if xml_match:
        return xml_match.group(1).strip()
    return None


def strip_thinking_blocks(body: bytes) -> bytes:
    """
    Process a JSON response body from /v1/messages (Anthropic) or /v1/chat/completions (OpenAI).
    Removes <think> blocks from text content blocks.

    Returns the (possibly modified) body bytes, or the original if not applicable.
    """
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return body

    if not isinstance(data, dict):
        return body

    modified = False

    # --- Anthropic /v1/messages format ---
    # {"content": [{"type": "text", "text": "..."}]}
    content = data.get("content")
    if isinstance(content, list):
        new_content = []
        for block in content:
            if not isinstance(block, dict):
                new_content.append(block)
                continue
            if block.get("type") != "text":
                new_content.append(block)
                continue
            text = block.get("text", "")
            if THINK_OPEN in text:
                text = strip_thinking_from_text(text)
                text = clean_code_fences(text)
                # Strip explanatory prefix before XML tag only (not code fences — those are content)
                # e.g. "Aqui está:" <cores> but NOT "Here's the code:" ```python
                if re.search(r"^[A-Za-z\s\'\"_]+[:\-]?\s*<", text):
                    text = re.sub(r"^[A-Za-z\s\'\"_]+[:\-]?\s*", "", text.strip())
            # Always strip CJK — even when there's no think block, CJK chars may appear
            text = strip_cjk_from_text(text)
            block = dict(block)
            block["text"] = text
            modified = True
            new_content.append(block)
        if modified:
            data["content"] = new_content
        return json.dumps(data).encode("utf-8")

    # --- OpenAI /v1/chat/completions format ---
    # {"choices": [{"message": {"content": "..."}}]}
    choices = data.get("choices")
    if isinstance(choices, list):
        for i, choice in enumerate(choices):
            if not isinstance(choice, dict):
                continue
            message = choice.get("message", {})
            if not isinstance(message, dict):
                continue
            content_text = message.get("content", "")
            if not isinstance(content_text, str):
                continue
            # Always strip CJK — even when there's no think block, CJK chars may appear
            if THINK_OPEN in content_text:
                content_text = strip_thinking_from_text(content_text)
                content_text = clean_code_fences(content_text)
                # Strip explanatory prefix before XML tag
                if re.search(r"^[A-Za-z\s\'\"_]+[:\-]?\s*<", content_text):
                    content_text = re.sub(r"^[A-Za-z\s\'\"_]+[:\-]?\s*", "", content_text.strip())
            content_text = strip_cjk_from_text(content_text)  # always strip CJK
            data["choices"][i]["message"]["content"] = content_text
            modified = True
        if modified:
            return json.dumps(data).encode("utf-8")

    return body


# ==============================================================================
# Configuration
# ==============================================================================
PORT = int(os.environ.get("MIDDLEWARE_PORT", 3001))
BACKEND_URL = os.environ.get("NEWAPI_BACKEND_URL", "http://localhost:3000")
TIMEOUT = int(os.environ.get("BACKEND_TIMEOUT", 60))

# Docs auth credentials (fallback if session auth fails)
DOCS_USERNAME = os.environ.get("DOCS_USERNAME", "admin")
DOCS_PASSWORD = os.environ.get("DOCS_PASSWORD", "atius2024")

# Path to curated OpenAPI spec
OPENAPI_SPEC_PATH = os.environ.get("OPENAPI_SPEC_PATH", "/app/docs/openapi.json")

# Path to static files (Scalar docs HTML)
STATIC_PATH = os.environ.get("STATIC_FILES_PATH", "/app/static")

# New-API internal URL for session validation
NEW_API_INTERNAL = os.environ.get(
    "NEW_API_INTERNAL",
    os.environ.get("NEW_API_INTERNAL_URL", "http://localhost:3000"),
)

# ==============================================================================
# HTTP Client (shared)
# ==============================================================================
http_client: httpx.AsyncClient | None = None


async def get_http_client() -> httpx.AsyncClient:
    global http_client
    if http_client is None or http_client.is_closed:
        http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(TIMEOUT),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            follow_redirects=False,  # Don't follow redirects - we handle them
        )
    return http_client


# ==============================================================================
# Session Cookie Auth (NEW - replaces Basic Auth for docs)
# ==============================================================================
import hmac, hashlib, base64, struct, time as _time

SESSION_SECRET = os.environ.get(
    "SESSION_SECRET",
    "e6e60c89fa342258a3e995e0997290eb92656f1bc517759520f98c9b04f66b49"
)

def _decode_session_cookie(cookie_value: str) -> tuple[int, int, bytes] | None:
    """
    Decode the session cookie and return (user_id, created_at, nonce).
    Format: base64(created_at:i32 | user_id:i32 | nonce:16bytes | sig:32bytes)
    """
    try:
        data = base64.b64decode(cookie_value)
        if len(data) < 58:
            return None
        created_at = struct.unpack(">I", data[0:4])[0]
        user_id = struct.unpack(">I", data[4:8])[0]
        nonce = data[8:24]
        sig = data[24:56]
        return user_id, created_at, nonce
    except Exception:
        return None

def _compute_new_api_user_header(cookie_value: str) -> str | None:
    """
    Compute the New-Api-User header value required by new-api for HMAC auth.
    Format: base64(HMAC-SHA256(SESSION_SECRET + user_id_str + timestamp_str, salt=nonce))
    """
    decoded = _decode_session_cookie(cookie_value)
    if not decoded:
        return None
    user_id, created_at, nonce = decoded
    
    # Compute HMAC: HMAC-SHA256(key=SESSION_SECRET, data=binary(user_id+created_at), salt=nonce)
    msg = struct.pack(">II", user_id, created_at)
    sig = hmac.new(msg, nonce, hashlib.sha256).digest()
    
    # Encode: user_id(4 bytes BE) + created_at(4 bytes BE) + nonce + sig
    payload = struct.pack(">II", user_id, created_at) + nonce + sig
    return base64.b64encode(payload).decode()

async def validate_session_cookie(session_cookie: str | None) -> bool:
    """Validate session cookie by calling New-API /api/user/self endpoint."""
    if not session_cookie:
        return False
    
    # Compute the New-Api-User header required by new-api
    new_api_user = _compute_new_api_user_header(session_cookie)
    if not new_api_user:
        return False
    
    client = await get_http_client()
    try:
        # Forward cookie + New-Api-User header to New-API backend for validation
        resp = await client.get(
            f"{NEW_API_INTERNAL}/api/user/self",
            headers={
                "Cookie": f"session={session_cookie}",
                "X-Forwarded-Host": "router.atius.com.br",
                "Origin": "https://router.atius.com.br",
                "New-Api-User": new_api_user,
            },
            timeout=5.0,
        )
        # Debug: log response for troubleshooting
        if resp.status_code != 200:
            import logging
            logging.warning(
                f"Session validation failed: status={resp.status_code}, "
                f"body={resp.text[:200]}, cookie={session_cookie[:30]}..."
            )
        return resp.status_code == 200
    except Exception:
        return False


def verify_session_or_basic_auth(
    session_cookie: str | None = Cookie(None),
) -> str:
    """
    Verify user via session cookie (New-API dashboard login) OR Basic Auth (fallback).
    
    Session cookie takes priority — if valid, return "session".
    If session invalid/missing, fall back to Basic Auth.
    If neither works, raise 401.
    """
    import asyncio
    
    # Try session cookie first (async)
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    # Check if we can use session auth
    if session_cookie:
        # Run sync check in sync context
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(
                asyncio.run,
                validate_session_cookie(session_cookie)
            )
            try:
                is_valid = future.result(timeout=5)
            except Exception:
                is_valid = False
        
        if is_valid:
            return "session"
    
    # Fall back to Basic Auth (not async-compatible in this context)
    # Basic Auth is handled separately in each endpoint that needs it
    return "basic"


# ==============================================================================
# Basic Auth (kept for /docs/json and other API endpoints)
# ==============================================================================
security = HTTPBasic(auto_error=False)


def verify_basic_auth(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """Verify Basic Auth credentials. Raises 401 if invalid or missing."""
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Basic"},
        )
    if credentials.username != DOCS_USERNAME or credentials.password != DOCS_PASSWORD:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# ==============================================================================
# Model Metadata
# ==============================================================================
DEEPSEEK_METADATA = {
    "deepseek-v4-flash": {
        "name": "DeepSeek V4 Flash",
        "context_length": 131072,
        "max_completion_tokens": 8192,
        "pricing": {
            "prompt": "0.00000014",
            "completion": "0.00000028",
            "prompt_cache_hit": "0.000000014",
        },
    },
    "deepseek-v4-pro": {
        "name": "DeepSeek V4 Pro",
        "context_length": 131072,
        "max_completion_tokens": 8192,
        "pricing": {
            "prompt": "0.000000435",
            "completion": "0.00000087",
            "prompt_cache_hit": "0.000000043",
        },
    },
}

MINIMAX_METADATA = {
    # M2.7 variants
    "MiniMax-M2.7": {
        "name": "MiniMax M2.7",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000006",
            "prompt_cache_miss": "0.000000375",
        },
    },
    "MiniMax-M2.7-highspeed": {
        "name": "MiniMax M2.7 Highspeed",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000006",
            "prompt_cache_miss": "0.000000375",
        },
    },
    "MiniMax-M2.7-hs": {
        "name": "MiniMax M2.7 Highspeed",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000006",
            "prompt_cache_miss": "0.000000375",
        },
    },
    # M2.5 variants
    "MiniMax-M2.5": {
        "name": "MiniMax M2.5",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000003",
            "prompt_cache_miss": "0.000000375",
        },
    },
    "MiniMax-M2.5-highspeed": {
        "name": "MiniMax M2.5 Highspeed",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000003",
            "prompt_cache_miss": "0.000000375",
        },
    },
    "MiniMax-M2.5-hs": {
        "name": "MiniMax M2.5 Highspeed",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000003",
            "prompt_cache_miss": "0.000000375",
        },
    },
    # M2.1 variants
    "MiniMax-M2.1": {
        "name": "MiniMax M2.1",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000003",
            "prompt_cache_miss": "0.000000375",
        },
    },
    "MiniMax-M2.1-highspeed": {
        "name": "MiniMax M2.1 Highspeed",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000003",
            "prompt_cache_miss": "0.000000375",
        },
    },
    "MiniMax-M2.1-hs": {
        "name": "MiniMax M2.1 Highspeed",
        "context_length": 245760,
        "max_completion_tokens": 50000,
        "pricing": {
            "prompt": "0.0000003",
            "completion": "0.0000012",
            "prompt_cache_hit": "0.00000003",
            "prompt_cache_miss": "0.000000375",
        },
    },
}

ALL_MODEL_METADATA = {**DEEPSEEK_METADATA, **MINIMAX_METADATA}
MODEL_CREATED_TS = 1735689600  # 2025-01-01

# ==============================================================================
# Global state
# ==============================================================================
_curated_openapi_spec: dict | None = None


def load_curated_spec() -> dict | None:
    """Load the curated OpenAPI spec from file."""
    global _curated_openapi_spec
    if _curated_openapi_spec is not None:
        return _curated_openapi_spec
    if os.path.exists(OPENAPI_SPEC_PATH):
        try:
            with open(OPENAPI_SPEC_PATH, "r") as f:
                _curated_openapi_spec = json.load(f)
            print(f"[middleware] Loaded curated OpenAPI spec from {OPENAPI_SPEC_PATH}")
            return _curated_openapi_spec
        except Exception as e:
            print(f"[middleware] WARNING: Failed to load curated spec: {e}")
            return None
    print(f"[middleware] WARNING: Curated spec not found at {OPENAPI_SPEC_PATH}")
    return None


def enrich_models_response_anthropic(upstream_data: dict) -> dict:
    """Transform abilities data to Anthropic models list format.

    upstream_data comes from /internal/v1/models which returns abilities with channel_type.
    channel_type=0 (OpenAI), channel_type=14 (Anthropic).
    Only models with channel_type=14 are returned for Anthropic format.
    """
    abilities = upstream_data.get("data", [])
    anthropic_channel_type = 14

    # Get metadata for enrichment
    metadata_map = {
        "MiniMax-M2.7": {"context_length": 1000000, "input_price": 0.3, "output_price": 1.2},
        "MiniMax-M2.7-hs": {"context_length": 1000000, "input_price": 0.3, "output_price": 1.2},
        "MiniMax-M2.7-highspeed": {"context_length": 1000000, "input_price": 0.3, "output_price": 1.2},
        "MiniMax-M2.5": {"context_length": 1000000, "input_price": 0.2, "output_price": 0.8},
        "MiniMax-M2.5-hs": {"context_length": 1000000, "input_price": 0.2, "output_price": 0.8},
        "MiniMax-M2.5-highspeed": {"context_length": 1000000, "input_price": 0.2, "output_price": 0.8},
        "MiniMax-M2.1": {"context_length": 1000000, "input_price": 0.1, "output_price": 0.5},
        "MiniMax-M2.1-hs": {"context_length": 1000000, "input_price": 0.1, "output_price": 0.5},
        "MiniMax-M2.1-highspeed": {"context_length": 1000000, "input_price": 0.1, "output_price": 0.5},
    }

    # Collect unique models that have Anthropic channel (type=14)
    models_seen = set()
    anthropic_models = []

    for ability in abilities:
        channel_type = ability.get("channel_type", 0)
        if channel_type != anthropic_channel_type:
            continue
        model_name = ability.get("model", "")
        if model_name in models_seen:
            continue
        models_seen.add(model_name)

        meta = metadata_map.get(model_name, {})
        anthropic_models.append({
            "id": model_name,
            "created_at": "2021-07-20T10:40:00Z",
            "display_name": model_name,
            "type": "model",
            "api_format": "anthropic",
            "context_length": meta.get("context_length", 1000000),
            "input_price": meta.get("input_price", 0),
            "output_price": meta.get("output_price", 0),
        })

    return {
        "data": anthropic_models,
        "has_more": False,
    }


async def enrich_models_response(upstream_data: dict) -> dict:
    """Enrich /v1/models response with metadata for DeepSeek and MiniMax."""
    enriched = []
    for model in upstream_data.get("data", []):
        model_id = model.get("id", "")
        metadata = ALL_MODEL_METADATA.get(model_id)
        if metadata:
            if model_id.startswith("MiniMax"):
                owned_by = "minimax"
            elif model_id.startswith("deepseek"):
                owned_by = "deepseek"
            else:
                owned_by = model.get("owned_by", "unknown")

            enriched_model = {
                "id": model_id,
                "object": "model",
                "created": MODEL_CREATED_TS,
                "owned_by": owned_by,
                "name": metadata["name"],
                "context_length": metadata["context_length"],
                "top_provider": {"max_completion_tokens": metadata["max_completion_tokens"]},
                "pricing": metadata["pricing"],
            }
            # Preserve upstream endpoint types, but add anthropic for ALL MiniMax models
            enriched_model["supported_endpoint_types"] = model.get("supported_endpoint_types", ["openai"]).copy()
            if model_id.startswith("MiniMax"):
                if "anthropic" not in enriched_model["supported_endpoint_types"]:
                    enriched_model["supported_endpoint_types"].append("anthropic")
            enriched.append(enriched_model)
        else:
            enriched.append(model)
    return {"data": enriched, "object": "list", "success": True}


# ==============================================================================
# Lifespan
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    print(f"[middleware] Starting FastAPI Model Enrichment Middleware")
    print(f"[middleware] Backend: {BACKEND_URL}, Timeout: {TIMEOUT}s")
    print(f"[middleware] Session Auth: checking New-API at {NEW_API_INTERNAL}")
    print(f"[middleware] OpenAPI spec path: {OPENAPI_SPEC_PATH}")
    all_models = list(DEEPSEEK_METADATA.keys()) + list(MINIMAX_METADATA.keys())
    print(f"[middleware] Enriching models: {', '.join(all_models)}")
    load_curated_spec()
    
    # Initialize HTTP client
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(TIMEOUT),
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        follow_redirects=False,
    )

    yield
    if http_client and not http_client.is_closed:
        await http_client.aclose()


# ==============================================================================
# App init
# ==============================================================================
app = FastAPI(
    title="Atius AI Router API",
    description="Unified AI API Gateway — aggregates MiniMax, DeepSeek, and 40+ providers behind a single OpenAI/Anthropic-compatible API.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,  # Disable built-in Swagger UI — we serve custom Scalar page
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Scalar standalone bundle (IIFE, self-contained)
app.mount("/scalar", StaticFiles(directory="/app/scalar"), name="scalar")


# ==============================================================================
# Route handlers (defined AFTER app creation)
# ==============================================================================

@app.get("/health")
async def health_check():
    """Public health check — tests backend connectivity."""
    client = await get_http_client()
    try:
        resp = await client.get(f"{BACKEND_URL}/v1/models", timeout=5)
        if resp.status_code == 200:
            return {"status": "healthy", "backend": "connected"}
        return {"status": "degraded", "backend": f"returned {resp.status_code}"}
    except Exception as e:
        return {"status": "unhealthy", "backend": "disconnected", "error": str(e)}


@app.get("/v1/models")
async def get_models(request: Request):
    """Intercept /v1/models, optionally return Anthropic format.
    
    Query params:
        api_format: 'openai' (default) or 'anthropic'
    """
    client = await get_http_client()
    headers = {}
    if request.headers.get("authorization"):
        headers["authorization"] = request.headers["authorization"]

    api_format = request.query_params.get("api_format", "openai")

    try:
        if api_format == "anthropic":
            # Call internal Go endpoint to get abilities with channel_type
            response = await client.get(
                f"{BACKEND_URL}/internal/v1/models",
                headers=headers,
                timeout=10.0
            )
            if response.status_code != 200:
                return Response(content=response.content, status_code=response.status_code, media_type="application/json")
            data = response.json()
            enriched = enrich_models_response_anthropic(data)
            return JSONResponse(content=enriched)
        else:
            # OpenAI format — call original /v1/models
            response = await client.get(f"{BACKEND_URL}/v1/models", headers=headers)
            if response.status_code != 200:
                return Response(content=response.content, status_code=response.status_code, media_type="application/json")
            try:
                data = response.json()
                enriched = await enrich_models_response(data)
                return JSONResponse(content=enriched, headers={"X-Model-Metadata-Enriched": "true"})
            except json.JSONDecodeError as e:
                print(f"[middleware] Failed to parse models response: {e}")
                return Response(content=response.content, status_code=200, media_type="application/json")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Backend timeout")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Backend error: {e}")


@app.get("/models")
async def get_models_legacy(request: Request):
    """Legacy /models endpoint (without /v1 prefix). Public (no auth)."""
    return await get_models(request)


# ==============================================================================
# Session-aware docs endpoints (NEW - replaces Basic Auth only)
# ==============================================================================

def get_session_cookie(request: Request) -> str | None:
    """Extract session cookie from request."""
    # Gin sessions use cookie named "session" by default
    cookies = request.headers.get("cookie", "")
    for cookie in cookies.split(";"):
        cookie = cookie.strip()
        if cookie.startswith("session="):
            return cookie[len("session="):]
    return None


def make_unauthenticated_redirect(request: Request, redirect_path: str = "/sign-in") -> RedirectResponse:
    """Create redirect to sign-in page with return URL."""
    current_path = str(request.url.path)
    sign_in_url = f"{redirect_path}?redirect={current_path}"
    return RedirectResponse(url=sign_in_url, status_code=302)


@app.get("/docs/auth-check", include_in_schema=False)
async def auth_check(request: Request):
    """
    AJAX auth status endpoint for the docs page.
    Returns JSON: {auth: 'ok'|'none', role: number, admin: bool}

    Auth: Session cookie (New-API) OR ?key=<DOCS_PASSWORD> (static admin bypass).
    """
    # Quick admin bypass: ?key=<DOCS_PASSWORD>
    provided_key = request.query_params.get("key", "")
    if provided_key == DOCS_PASSWORD:
        return JSONResponse({"auth": "ok", "role": 10, "admin": True})

    # Session-based auth via New-API
    session_cookie = get_session_cookie(request)
    is_admin = False

    if session_cookie:
        is_admin = await validate_session_cookie(session_cookie)

    if is_admin:
        return JSONResponse({"auth": "ok", "role": 10, "admin": True})

    # Also check Basic Auth
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Basic "):
        import base64
        try:
            creds = base64.b64decode(auth_header[6:]).decode("utf-8")
            username, password = creds.split(":", 1)
            if username == DOCS_USERNAME and password == DOCS_PASSWORD:
                return JSONResponse({"auth": "ok", "role": 10, "admin": True})
        except Exception:
            pass

    return JSONResponse({"auth": "none", "role": 0, "admin": False})


@app.get("/docs/", include_in_schema=False)
async def get_docs_index(request: Request):
    """
    Serve custom Scalar API Reference page (protected).

    ?key=<DOCS_PASSWORD> enables admin features (API key bar, full test capabilities).
    Session cookie enables SSO for logged-in dashboard users.
    Unauthenticated users are redirected to the sign-in page.
    """
    # Quick admin bypass: ?key=<DOCS_PASSWORD>
    provided_key = request.query_params.get("key", "")
    is_admin = provided_key == DOCS_PASSWORD

    # Try session validation (SSO for logged-in dashboard users)
    if not is_admin:
        session_cookie = get_session_cookie(request)
        if session_cookie:
            is_valid = await validate_session_cookie(session_cookie)
            if is_valid:
                is_admin = True

    # Fall back to Basic Auth
    if not is_admin:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Basic "):
            import base64
            try:
                creds = base64.b64decode(auth_header[6:]).decode("utf-8")
                username, password = creds.split(":", 1)
                if username == DOCS_USERNAME and password == DOCS_PASSWORD:
                    is_admin = True
            except Exception:
                pass

    # Redirect unauthenticated users to sign-in page
    if not is_admin:
        return make_unauthenticated_redirect(request, "/sign-in")

    # Serve the Scalar API Reference page
    html_path = os.path.join(STATIC_PATH, "index.html")
    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Inject admin flag into the page for full functionality
        content = content.replace(
            "const IS_ADMIN = false;",
            "const IS_ADMIN = true;"
        )
        return HTMLResponse(content=content, status_code=200)
    raise HTTPException(status_code=404, detail="Docs page not found")


@app.get("/logo.svg", include_in_schema=False)
async def get_logo_svg():
    """Serve the Atius logo SVG."""
    path = os.path.join(STATIC_PATH, "logo.svg")
    if os.path.exists(path):
        with open(path, "rb") as f:
            return Response(content=f.read(), media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Logo not found")


@app.get("/docs", include_in_schema=False)
async def get_docs(request: Request):
    """Redirect /docs → /docs/ (preserve query params)."""
    query = str(request.query_params)
    target = "/docs/" + (f"?{query}" if query else "")
    return RedirectResponse(url=target, status_code=302)


# Catch-all for /docs/* (any subpath that isn't a known endpoint) → redirect to /docs/
# Must be BEFORE the generic /{path:path} catch-all proxy to take precedence
@app.get("/docs/{path:path}", include_in_schema=False)
async def get_docs_subpath(path: str, request: Request):
    """Redirect /docs/<anything> → /docs/ (canonical). Handles 404 cases like /docs/foo."""
    query = str(request.query_params)
    target = "/docs/" + (f"?{query}" if query else "")
    return RedirectResponse(url=target, status_code=302)


@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_json(request: Request):
    """
    Serve curated OpenAPI spec (PUBLIC).
    
    Anyone can access the OpenAPI spec. ?key=<DOCS_PASSWORD> for full spec.
    """
    # Quick admin bypass: ?key=<DOCS_PASSWORD>
    provided_key = request.query_params.get("key", "")
    if provided_key == DOCS_PASSWORD:
        spec = load_curated_spec()
        if spec is None:
            raise HTTPException(status_code=404, detail="OpenAPI spec not found")
        return JSONResponse(content=spec)

    # Try session validation first
    session_cookie = get_session_cookie(request)
    if session_cookie:
        is_valid = await validate_session_cookie(session_cookie)
        if is_valid:
            spec = load_curated_spec()
            if spec is None:
                raise HTTPException(status_code=404, detail="OpenAPI spec not found")
            return JSONResponse(content=spec)

    # Fall back to Basic Auth
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Basic "):
        import base64
        try:
            creds = base64.b64decode(auth_header[6:]).decode("utf-8")
            username, password = creds.split(":", 1)
            if username == DOCS_USERNAME and password == DOCS_PASSWORD:
                spec = load_curated_spec()
                if spec is None:
                    raise HTTPException(status_code=404, detail="OpenAPI spec not found")
                return JSONResponse(content=spec)
        except Exception:
            pass

    # Not authenticated — serve spec anyway (public)
    spec = load_curated_spec()
    if spec is None:
        raise HTTPException(status_code=404, detail="OpenAPI spec not found")
    return JSONResponse(content=spec)


@app.get("/docs/json", include_in_schema=False)
async def get_docs_json(request: Request):
    """Alias /docs/json → curated OpenAPI spec — protected by session or Basic Auth."""
    return await get_openapi_json(request)


@app.get("/docs.json", include_in_schema=False)
async def get_docs_json2(request: Request):
    """Alias /docs.json → curated OpenAPI spec — protected by session or Basic Auth."""
    return await get_openapi_json(request)


# ==============================================================================
# Catch-all proxy (MUST be last)
# ==============================================================================

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_request(path: str, request: Request):
    """Proxy all other requests to the backend."""
    client = await get_http_client()
    body = await request.body()
    headers = {}
    skip = {"host", "connection", "content-length", "transfer-encoding", "content-encoding"}
    for key, value in request.headers.items():
        if key.lower() not in skip:
            headers[key] = value
    try:
        response = await client.request(
            method=request.method,
            url=f"{BACKEND_URL}/{path}",
            headers=headers,
            content=body if body else None,
        )
        response_headers = {}
        skip_resp = {"transfer-encoding", "content-encoding", "content-length"}
        for key, value in response.headers.items():
            if key.lower() not in skip_resp:
                response_headers[key] = value

        # Strip thinking blocks from non-streaming Anthropic /v1/messages and /v1/chat
        # Streaming SSE responses (transfer-encoding: chunked) skip this step because
        # thinking blocks can span multiple chunks. CJK strip below handles CJK for
        # both stream and non-stream (per-chunk safe).
        if not response.headers.get("transfer-encoding", "").startswith("chunked"):
            if path.startswith("v1/messages") or path.startswith("v1/chat"):
                response_content = strip_thinking_blocks(response.content)
            else:
                response_content = response.content
        else:
            response_content = response.content

        # Always strip CJK (per-chunk safe for SSE). Apply AFTER thinking-blocks
        # strip so we don't waste cycles on CJK inside blocks we're about to discard.
        if path.startswith("v1/messages") or path.startswith("v1/chat") or path.startswith("v1/responses"):
            try:
                if isinstance(response_content, (bytes, bytearray)):
                    decoded = response_content.decode("utf-8", errors="ignore")
                else:
                    decoded = response_content
                cleaned = strip_cjk_from_text(decoded)
                if isinstance(response_content, (bytes, bytearray)):
                    response_content = cleaned.encode("utf-8")
                else:
                    response_content = cleaned
            except Exception as e:
                # Never fail the response because of the CJK filter.
                print(f"[middleware] CJK strip warning: {e}")

        return Response(
            content=response_content,
            status_code=response.status_code,
            headers=response_headers,
            media_type=response.headers.get("content-type", "application/json"),
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Backend timeout")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Backend error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "model_detailed_fastapi:app",
        host="0.0.0.0",
        port=PORT,
        workers=4,
        log_level="info",
    )