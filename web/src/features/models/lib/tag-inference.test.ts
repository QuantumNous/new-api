import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  inferContextFromModelName,
  inferModelDefaults,
  inferPipelineTag,
  inferTagsFromModelName,
} from './tag-inference'

/**
 * These tests pin down the tag/context inference for real-world model names
 * we've seen in the wild. If a customer ships a new model family, add a
 * case here rather than tweaking regex patterns blindly.
 *
 * The inference is name-only, so it produces conservative defaults — an
 * admin can always append/remove tags in the UI.
 */
describe('inferTagsFromModelName — capability tags', () => {
  test('empty / whitespace returns []', () => {
    assert.deepEqual(inferTagsFromModelName(''), [])
    assert.deepEqual(inferTagsFromModelName('   '), [])
  })

  test('generic chat model falls back to chat + tools hint', () => {
    const tags = inferTagsFromModelName('gpt-5-turbo')
    assert.ok(tags.includes('chat'), tags.join(','))
    assert.ok(tags.includes('function-calling'), tags.join(','))
    assert.ok(tags.includes('tools'), tags.join(','))
  })

  test('unknown provider name — bare chat, no tools hint', () => {
    const tags = inferTagsFromModelName('deepseek-v4-pro')
    // deepseek-v4-pro is not in FUNCTION_CALLING_HINT_PATTERNS (only v2/v3
    // are); the intended user question was "is this a reasoning or video
    // model?" — answer: neither, plain chat.
    assert.deepEqual(tags, ['chat'])
  })

  test('deepseek-r1 → reasoning (not chat-with-tools)', () => {
    const tags = inferTagsFromModelName('deepseek-r1-pro')
    assert.ok(tags.includes('reasoning'), tags.join(','))
    assert.ok(tags.includes('chat'), tags.join(','))
    // Reasoning models generally can't do function-calling reliably; make
    // sure the tools hint is suppressed.
    assert.ok(!tags.includes('function-calling'), tags.join(','))
    assert.ok(!tags.includes('tools'), tags.join(','))
  })

  test('qwen-vl → vision + chat', () => {
    const tags = inferTagsFromModelName('qwen-vl-72b')
    assert.ok(tags.includes('vision'), tags.join(','))
    assert.ok(tags.includes('chat'), tags.join(','))
  })

  test('glm-4v → vision (via -4v matcher)', () => {
    const tags = inferTagsFromModelName('glm-4v-plus')
    assert.ok(tags.includes('vision'), tags.join(','))
  })

  test('qwen3-coder-480b → code + chat', () => {
    const tags = inferTagsFromModelName('qwen3-coder-480b')
    assert.ok(tags.includes('code'), tags.join(','))
    assert.ok(tags.includes('chat'), tags.join(','))
  })

  test('whisper-1 → audio', () => {
    const tags = inferTagsFromModelName('whisper-1')
    assert.ok(tags.includes('audio'), tags.join(','))
  })

  test('sora → video, no chat', () => {
    const tags = inferTagsFromModelName('sora-turbo')
    assert.ok(tags.includes('video'), tags.join(','))
    assert.ok(!tags.includes('chat'), tags.join(','))
  })

  test('doubao-seedance-2-0 → video (volcengine video model)', () => {
    const tags = inferTagsFromModelName('doubao-seedance-2-0')
    assert.ok(tags.includes('video'), tags.join(','))
    assert.ok(!tags.includes('chat'), tags.join(','))
  })

  test('doubao-seedream → image (not video, not chat)', () => {
    const tags = inferTagsFromModelName('doubao-seedream-3-0')
    assert.ok(tags.includes('image'), tags.join(','))
    assert.ok(!tags.includes('video'), tags.join(','))
    assert.ok(!tags.includes('chat'), tags.join(','))
  })

  test('flux-1.1-pro → image', () => {
    const tags = inferTagsFromModelName('flux-1.1-pro')
    assert.ok(tags.includes('image'), tags.join(','))
  })

  test('text-embedding-3-large → embedding (no chat/tools)', () => {
    const tags = inferTagsFromModelName('text-embedding-3-large')
    assert.deepEqual(tags, ['embedding'])
  })

  test('gpt-4o → chat + vision + tools (omni multi-modal)', () => {
    const tags = inferTagsFromModelName('gpt-4o-2026-08-06')
    assert.ok(tags.includes('chat'), tags.join(','))
    assert.ok(tags.includes('vision'), tags.join(','))
    assert.ok(tags.includes('function-calling'), tags.join(','))
    assert.ok(tags.includes('tools'), tags.join(','))
  })

  test('o1-mini → reasoning', () => {
    const tags = inferTagsFromModelName('o1-mini')
    assert.ok(tags.includes('reasoning'), tags.join(','))
  })

  test('wan2.7-i2v → video', () => {
    const tags = inferTagsFromModelName('wan2.7-i2v-plus')
    assert.ok(tags.includes('video'), tags.join(','))
  })

  test('qwen-turbo-realtime → audio (realtime API is audio-oriented)', () => {
    const tags = inferTagsFromModelName('gpt-4o-realtime-preview')
    assert.ok(tags.includes('audio'), tags.join(','))
  })
})

describe('inferContextFromModelName — window sizing', () => {
  test('unknown name → undefined (do not overwrite the field)', () => {
    assert.equal(inferContextFromModelName('some-experimental-model'), undefined)
  })

  test('claude-4-opus → 1M context', () => {
    assert.equal(inferContextFromModelName('claude-4-opus'), 1_000_000)
  })

  test('gpt-4o-mini → 128k', () => {
    assert.equal(inferContextFromModelName('gpt-4o-mini'), 128_000)
  })

  test('claude-3.5-sonnet → 200k', () => {
    assert.equal(inferContextFromModelName('claude-3-5-sonnet-20241022'), 200_000)
  })

  test('gemini-2-flash → 1M', () => {
    assert.equal(inferContextFromModelName('gemini-2-flash-thinking-exp'), 1_000_000)
  })

  test('gpt-3.5-turbo-16k → 16k (literal marker wins)', () => {
    assert.equal(inferContextFromModelName('gpt-3.5-turbo-16k'), 16_384)
  })

  test('explicit -32k marker → 32k', () => {
    assert.equal(inferContextFromModelName('custom-model-32k'), 32_768)
  })
})

/**
 * These pipeline_tag tests document how the three lookup layers stack. If a
 * model that used to fall through to `regex` starts landing on `registry`
 * (because someone added it to KNOWN_MODELS), just update the expected
 * `source` — the assertion is there to make that change intentional.
 */
describe('inferPipelineTag — 3-tier lookup', () => {
  test('empty input → other + fallback', () => {
    assert.deepEqual(inferPipelineTag(''), {
      pipelineTag: 'other',
      source: 'fallback',
    })
  })

  test('registry hit: gpt-4o → image-text-to-text (source=registry)', () => {
    const result = inferPipelineTag('gpt-4o-2026-08-06')
    assert.equal(result.pipelineTag, 'image-text-to-text')
    assert.equal(result.source, 'registry')
  })

  test('registry hit: doubao-seedance-2-0 → text-to-video (source=registry)', () => {
    const result = inferPipelineTag('doubao-seedance-2-0')
    assert.equal(result.pipelineTag, 'text-to-video')
    assert.equal(result.source, 'registry')
  })

  test('registry hit: deepseek-r1-pro → text-generation with reasoning extra', () => {
    const result = inferPipelineTag('deepseek-r1-pro')
    assert.equal(result.pipelineTag, 'text-generation')
    assert.equal(result.source, 'registry')
    // Legacy tags surface via inferModelDefaults, not the pipeline_tag itself.
    const defaults = inferModelDefaults('deepseek-r1-pro')
    assert.ok(defaults.tags.includes('reasoning'), defaults.tags.join(','))
  })

  test('regex fallback: unknown -i2v suffix → image-to-video (source=regex)', () => {
    const result = inferPipelineTag('cool-startup-i2v-alpha')
    assert.equal(result.pipelineTag, 'image-to-video')
    assert.equal(result.source, 'regex')
  })

  test('regex fallback: reranker in name → text-ranking', () => {
    const result = inferPipelineTag('some-open-source-reranker-v3')
    assert.equal(result.pipelineTag, 'text-ranking')
    assert.equal(result.source, 'regex')
  })

  test('regex fallback: unknown flux fork → text-to-image', () => {
    const result = inferPipelineTag('flux-dev-lora-community')
    // Prefix match hits KNOWN_MODELS ("flux") — that's fine, still resolves.
    assert.equal(result.pipelineTag, 'text-to-image')
  })

  test('fallback: totally unknown name → text-generation', () => {
    const result = inferPipelineTag('acme-secret-model-77')
    assert.equal(result.pipelineTag, 'text-generation')
    assert.equal(result.source, 'fallback')
  })
})

describe('inferModelDefaults — end-to-end HF taxonomy', () => {
  test('doubao-seedream → image group + [image] legacy tag', () => {
    const d = inferModelDefaults('doubao-seedream-3-0')
    assert.equal(d.pipelineTag, 'text-to-image')
    assert.equal(d.group, 'vision')
    assert.ok(d.tags.includes('image'), d.tags.join(','))
    assert.ok(!d.tags.includes('chat'), d.tags.join(','))
  })

  test('gpt-4o → multimodal group + vision + chat + tools', () => {
    const d = inferModelDefaults('gpt-4o-mini')
    assert.equal(d.pipelineTag, 'image-text-to-text')
    assert.equal(d.group, 'multimodal')
    assert.ok(d.tags.includes('chat'), d.tags.join(','))
    assert.ok(d.tags.includes('vision'), d.tags.join(','))
    assert.ok(d.tags.includes('function-calling'), d.tags.join(','))
  })

  test('unknown name still returns text-generation defaults', () => {
    const d = inferModelDefaults('acme-secret-model-77')
    assert.equal(d.pipelineTag, 'text-generation')
    assert.equal(d.group, 'nlp')
    assert.deepEqual(d.tags, ['chat'])
    assert.equal(d.source, 'fallback')
  })

  test('whisper-large-v3 → audio group + [audio] tag', () => {
    const d = inferModelDefaults('whisper-large-v3')
    assert.equal(d.pipelineTag, 'automatic-speech-recognition')
    assert.equal(d.group, 'audio')
    assert.deepEqual(d.tags, ['audio'])
  })

  test('bge-reranker → text-ranking + embedding legacy tag', () => {
    const d = inferModelDefaults('bge-reranker-v2-m3')
    assert.equal(d.pipelineTag, 'text-ranking')
    assert.equal(d.group, 'nlp')
    assert.ok(d.tags.includes('embedding'), d.tags.join(','))
    assert.ok(!d.tags.includes('chat'), d.tags.join(','))
  })
})
