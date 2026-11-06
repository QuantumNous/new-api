import type {
  LanguageModelV4FinishReason,
  LanguageModelV4StreamPart,
  LanguageModelV4ToolApprovalRequest,
  LanguageModelV4ToolCall,
  LanguageModelV4ToolResult,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import type { z } from 'zod/v4';
import { expectTypeOf, test } from 'vitest';
import type {
  HarnessV1StreamPart,
  harnessV1StreamPartSchema,
} from './harness-v1-stream-part';

type V4PartByType<T extends LanguageModelV4StreamPart['type']> = Extract<
  LanguageModelV4StreamPart,
  { type: T }
>;
type HPartByType<T extends HarnessV1StreamPart['type']> = Extract<
  HarnessV1StreamPart,
  { type: T }
>;

// Helper: drop the harness-specific metadata field before comparing to V4.
// V4 has `providerMetadata`, harness has `harnessMetadata` — different keys
// by design, so we compare only the shared structural fields.
type WithoutHarnessMetadata<T> = Omit<T, 'harnessMetadata'>;
type WithoutProviderMetadata<T> = Omit<T, 'providerMetadata'>;

test('text/reasoning variants are structurally assignable to V4 (modulo metadata key)', () => {
  expectTypeOf<
    WithoutHarnessMetadata<HPartByType<'text-start'>>
  >().toMatchTypeOf<WithoutProviderMetadata<V4PartByType<'text-start'>>>();
  expectTypeOf<
    WithoutHarnessMetadata<HPartByType<'text-delta'>>
  >().toMatchTypeOf<WithoutProviderMetadata<V4PartByType<'text-delta'>>>();
  expectTypeOf<WithoutHarnessMetadata<HPartByType<'text-end'>>>().toMatchTypeOf<
    WithoutProviderMetadata<V4PartByType<'text-end'>>
  >();
  expectTypeOf<
    WithoutHarnessMetadata<HPartByType<'reasoning-start'>>
  >().toMatchTypeOf<WithoutProviderMetadata<V4PartByType<'reasoning-start'>>>();
  expectTypeOf<
    WithoutHarnessMetadata<HPartByType<'reasoning-delta'>>
  >().toMatchTypeOf<WithoutProviderMetadata<V4PartByType<'reasoning-delta'>>>();
  expectTypeOf<
    WithoutHarnessMetadata<HPartByType<'reasoning-end'>>
  >().toMatchTypeOf<WithoutProviderMetadata<V4PartByType<'reasoning-end'>>>();
});

test('tool variants reuse V4 primitives verbatim', () => {
  // tool-call is the V4 type plus optional `nativeName`. A value matching V4
  // must therefore satisfy the harness variant.
  expectTypeOf<LanguageModelV4ToolCall>().toMatchTypeOf<
    HPartByType<'tool-call'>
  >();
  // The reverse direction must also hold on the V4-defined fields.
  expectTypeOf<
    Omit<HPartByType<'tool-call'>, 'nativeName'>
  >().toMatchTypeOf<LanguageModelV4ToolCall>();

  // tool-approval-request and tool-result are direct re-uses.
  expectTypeOf<
    HPartByType<'tool-approval-request'>
  >().toEqualTypeOf<LanguageModelV4ToolApprovalRequest>();
  expectTypeOf<
    HPartByType<'tool-result'>
  >().toEqualTypeOf<LanguageModelV4ToolResult>();
});

test('finish + finish-step reuse exact V4 finish-reason + usage', () => {
  expectTypeOf<
    HPartByType<'finish'>['finishReason']
  >().toEqualTypeOf<LanguageModelV4FinishReason>();
  expectTypeOf<
    HPartByType<'finish'>['totalUsage']
  >().toEqualTypeOf<LanguageModelV4Usage>();
  expectTypeOf<
    HPartByType<'finish-step'>['finishReason']
  >().toEqualTypeOf<LanguageModelV4FinishReason>();
  expectTypeOf<
    HPartByType<'finish-step'>['usage']
  >().toEqualTypeOf<LanguageModelV4Usage>();
});

test('error variant matches V4 error variant', () => {
  expectTypeOf<HPartByType<'error'>>().toEqualTypeOf<V4PartByType<'error'>>();
});

test('raw variant matches V4 raw variant', () => {
  expectTypeOf<HPartByType<'raw'>>().toEqualTypeOf<V4PartByType<'raw'>>();
});

test('runtime schema infers exactly the hand-written stream-part type', () => {
  // The single source of truth is the `HarnessV1StreamPart` type; the Zod
  // schema is its runtime encoding. The pair of `Exclude` assertions below is
  // bidirectional assignability: every inferred member must be assignable to a
  // hand-written variant and vice versa, so a renamed/retyped/added/dropped
  // field surfaces as a non-`never` residue. Assignability (rather than the
  // invariant-position equality trick) is used deliberately — the schema reuses
  // a recursive `JSONValue` encoding, which defeats that trick with false
  // negatives. This also catches upstream `@ai-sdk/provider` V4 tool-shape
  // drift, since the type references those primitives directly.
  type Inferred = z.infer<typeof harnessV1StreamPartSchema>;
  expectTypeOf<Exclude<Inferred, HarnessV1StreamPart>>().toEqualTypeOf<never>();
  expectTypeOf<Exclude<HarnessV1StreamPart, Inferred>>().toEqualTypeOf<never>();

  // Completeness: the set of `type` discriminants must match exactly, so a
  // whole variant cannot go missing or extra (which the assignability checks
  // above can miss for unions).
  expectTypeOf<Inferred['type']>().toEqualTypeOf<HarnessV1StreamPart['type']>();
});

test('discriminated union narrows on `type`', () => {
  const part = {} as HarnessV1StreamPart;
  if (part.type === 'text-delta') {
    expectTypeOf(part.delta).toEqualTypeOf<string>();
    expectTypeOf(part.id).toEqualTypeOf<string>();
  }
  if (part.type === 'finish') {
    expectTypeOf(part.totalUsage).toEqualTypeOf<LanguageModelV4Usage>();
  }
  if (part.type === 'file-change') {
    expectTypeOf(part.event).toEqualTypeOf<'create' | 'modify' | 'delete'>();
    expectTypeOf(part.path).toEqualTypeOf<string>();
  }
  if (part.type === 'compaction') {
    expectTypeOf(part.trigger).toEqualTypeOf<'manual' | 'auto'>();
    expectTypeOf(part.summary).toEqualTypeOf<string>();
    expectTypeOf(part.tokensBefore).toEqualTypeOf<number | undefined>();
    expectTypeOf(part.tokensAfter).toEqualTypeOf<number | undefined>();
  }
});
