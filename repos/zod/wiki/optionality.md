# Optionality in Zod v4

Internal reference for how Zod's parsing handles "missing" / "undefined" input. Reflects the current state of `main` plus the in-flight branch `fix-fallback-flag-and-preprocess`.

The system has accumulated a few orthogonal mechanisms. This doc names them, says which schema sets what, and walks through the gnarly interactions.

## TL;DR

Three runtime signals, each with a single consumer:

| Signal | Set by | Consumed by | Means |
|---|---|---|---|
| `_zod.optin === "optional"` | catch, default, prefault, optional, transform | `$ZodObject`, `$ZodTuple`, `$ZodOptional` | "I accept absent input" |
| `_zod.optout === "optional"` | optional, exact-optional, default-on-output cases | `$ZodObject`, `$ZodTuple` | "My output may legitimately be `undefined`; treat that as absent for length-shortening / key-omission" |
| `payload.fallback === true` | catch (when `catchValue` substitutes), transform | `$ZodOptional` (in `handleOptionalResult`) | "This value is provisional; an outer wrapper may override it on undefined input" |

Plus one bookkeeping flag:

| Signal | Set by | Consumed by | Means |
|---|---|---|---|
| `payload.aborted` | pipe stage with issues, codecs | downstream stages | Skip remaining work in the chain |

## The two dimensions

Optionality has two independent axes:

1. **Presence**: was the key/index *in* the input at all?
2. **Value validity**: is the value at that position acceptable to the schema?

Pre-4.4, Zod conflated these: for object property `a`, parsing `{}` and parsing `{ a: undefined }` ran the same code path. Whatever the property schema produced for `undefined` input got assigned. This was unsound — schemas that statically said "key is required" would silently accept missing keys at runtime.

#5661 split the two axes. `$ZodObject` and `$ZodTuple` now consult `optin` to decide whether absent input is *legal*, before running the property schema at all.

## `optin`

> "Can the parent container omit this slot?"

A static-and-runtime declaration on the schema's `_zod`. Possible values: `"optional"` or `undefined`.

### Who sets it

| Schema | `optin` (static) | `optin` (runtime) | Notes |
|---|---|---|---|
| `$ZodOptional` | `"optional"` | `"optional"` | Hardcoded — that's its purpose |
| `$ZodExactOptional` | `"optional"` | `"optional"` | Same as optional, no value-side undefined widening |
| `$ZodNonOptional` | `"optional" \| undefined` | inherits inner | Only narrows the *type* of the value |
| `$ZodDefault` | `"optional"` | `"optional"` | Hardcoded |
| `$ZodPrefault` | `"optional"` | `"optional"` | Hardcoded |
| `$ZodCatch` | `T["_zod"]["optin"]` (defers to inner) | `"optional"` | **Static/runtime divergence** — see below |
| `$ZodTransform` | inherited (`undefined` by default) | `"optional"` | **Static/runtime divergence** — branch only, prototype |
| `$ZodPipe` | `def.in._zod.optin` (lazy defer to in side) | same | The leading position of the pipe drives optin |
| `$ZodPreprocess` | `B["_zod"]["optin"]` (defers to inner) | inherits via pipe (in = transform → `"optional"`) | After the prototype, no constructor body |
| `$ZodNullable` | `T["_zod"]["optin"]` | same | Transparent |
| `$ZodReadonly` | `T["_zod"]["optin"]` | same | Transparent |
| Everything else (string, number, etc.) | `undefined` | `undefined` | Required by default |

### Static/runtime divergence

Three schemas declare static `optin` differently from runtime `optin`:

- **`$ZodCatch`**: static defers to inner, runtime is `"optional"`. Why: input type should still show the key as required (catch is a recovery mechanism, not a presence statement), but the runtime should accept absent keys (catch's substitution covers them).

- **`$ZodTransform`**: static is undefined (inherited), runtime is `"optional"`. Why: same reasoning as catch — transform's static input type stays required, but at runtime the fn runs with whatever input shows up, including `undefined`.

- **`$ZodPreprocess`**: inherits via pipe, so both static and runtime trace through `def.in = $ZodTransform`. Static type ends up `B["_zod"]["optin"]` because of the interface declaration on `$ZodPreprocessInternals` (overrides the pipe-inherited type). Runtime ends up `"optional"` because pipe's runtime defers to `def.in.optin = transform.optin = "optional"`.

The user-visible consequence: `z.input<typeof z.object({ a: z.preprocess(fn, T) })>` shows `a` as required, but `parse({})` succeeds. Same trick catch uses.

### How the consumer reads it

`$ZodObject.handlePropertyResult` (and the JIT codegen mirroring it):

```ts
const isPresent = key in input;
const isOptionalIn = propSchema._zod.optin === "optional";

if (result.issues.length) {
  if (isOptionalIn && isOptionalOut && !isPresent) {
    return; // swallow the issue — schema can't possibly succeed on absent input but is allowed to fail
  }
  final.issues.push(...prefixed);
}

if (!isPresent && !isOptionalIn) {
  if (!result.issues.length) {
    final.issues.push({ code: "invalid_type", expected: "nonoptional", input: undefined, path: [key] });
  }
  return; // never assign on absent + required
}

if (result.value === undefined) {
  if (isPresent) (final.value as any)[key] = undefined; // preserve explicit undefined
} else {
  (final.value as any)[key] = result.value;
}
```

`$ZodTuple` does the analogous thing for trailing tuple slots.

`$ZodOptional` (the standalone wrapper) reads the *inner's* `optin` to decide whether to short-circuit on `undefined` input:

```ts
inst._zod.parse = (payload, ctx) => {
  if (def.innerType._zod.optin === "optional") {
    const input = payload.value;
    const result = def.innerType._zod.run(payload, ctx);
    return handleOptionalResult(result, input);
  }
  if (payload.value === undefined) return payload; // short-circuit: inner doesn't claim to handle undefined, return undefined as-is
  return def.innerType._zod.run(payload, ctx);
};
```

So `optional` *invokes* its inner whenever inner says "I handle absence." It only short-circuits when inner is silent on the question.

## `optout`

> "Can my output be `undefined` even when input was present, and should the parent treat that as 'absent' for length-shortening / key-omission?"

A separate axis from `optin`. Set by:

| Schema | `optout` |
|---|---|
| `$ZodOptional` | `"optional"` |
| `$ZodExactOptional` | `"optional"` |
| Everything else | inherited or `undefined` |

`$ZodObject` uses it (combined with `optin` and `isPresent`) to decide whether to assign or skip. `$ZodTuple` uses it to decide whether to trim a trailing slot whose value came back as `undefined`.

The relevant observation for users: a schema can be **input-required, output-optional** (`z.string().nullable()` with some shapes), or **input-optional, output-required** (`z.string().default("d")` — accepts absence, never produces undefined). The `optin` × `optout` matrix has all four combinations and they all matter for object/tuple parsing.

## `fallback`

> "An outer wrapper may override this value with its own interpretation when input was undefined."

A *runtime-only* payload flag. Lives on `ParsePayload`:

```ts
interface ParsePayload<T> {
  value: T;
  issues: $ZodRawIssue[];
  aborted?: boolean;
  fallback?: boolean | undefined;
}
```

### Who sets it

| Schema | When | Why |
|---|---|---|
| `$ZodCatch` | When `catchValue` substitutes (i.e., the inner schema produced issues) | The substituted value is a recovery, not a deliberate output; an outer optional should be allowed to clobber it |
| `$ZodTransform` | On every fn invocation (sync and async paths, both core and classic constructors) | The transform's output is provisional — for `undefined` input specifically, an outer optional should treat the transform's output as "what we got when input was missing" and replace with `undefined` |

### Who reads it

Only `$ZodOptional`, in `handleOptionalResult`:

```ts
function handleOptionalResult(result: ParsePayload, input: unknown) {
  if (input === undefined && (result.issues.length || result.fallback)) {
    return { issues: [], value: undefined };
  }
  return result;
}
```

Translation: "If the *original* input to optional was `undefined`, and the inner either failed or produced a fallback value, override with `undefined`."

The `input === undefined` gate is critical: when input was a defined value, the inner's output is the *real* output (e.g., a successful transform run), not a fallback, even if the flag happens to be set. This is what makes "always set on transform" safe — defined-input transforms have the flag set but it's never read.

### Pipe propagation

`handlePipeResult` builds a fresh payload for the right-hand side of a pipe:

```ts
return next._zod.run({ value: left.value, issues: left.issues, fallback: left.fallback }, ctx);
```

The `fallback` propagation is what #5941 fixed. Before that fix, any chain shaped like `catch().transform()...optional()` would lose the flag at the implicit pipe boundary that `.transform()` introduces, and `optional` couldn't tell that the inner had recovered.

## What's `respect` vs `clobber`?

When `optional` wraps a schema that produced *some* value for `undefined` input, the question is: does the wrapper return the inner value (respect), or override with `undefined` (clobber)?

The rule, expressed in `handleOptionalResult`:

```
input was undefined AND (issues OR fallback)  →  clobber
otherwise                                     →  respect
```

So:

| Inner schema produced... | issues? | fallback? | result |
|---|---|---|---|
| valid value via normal path (default fired, prefault filled) | no | no | **respect** — return inner value |
| recovery substitution (catch fired) | no (cleared) | yes | **clobber** — return undefined |
| transform's output (preprocess, standalone transform, anything with a transform fn at the input side) | no | yes | **clobber** — return undefined |
| failed validation but no recovery | yes | no | **clobber** (issues swallowed) — return undefined |

### Why default and prefault aren't clobbered

Default and prefault both set `optin = "optional"` at runtime, so `optional` invokes them. But they don't set `fallback`. `default` short-circuits on undefined input *before* running inner — it's an explicit absence handler that returns `def.defaultValue` directly. `prefault` substitutes the prefault value into the input *before* running inner. Both produce a "deliberate value" rather than a "recovery value" — which is why `optional` respects them.

### Why catch is clobbered

Catch runs inner, and only fires when inner produces *issues*. The substitution is reactive — "I'm recovering from a failure." On `undefined` input, inner failed because inner doesn't accept `undefined`, not because the user really wanted "the substitution value." Optional says: "the user wrote `.optional()`, so on undefined input they want `undefined`, not your recovery."

### Why transform is clobbered

For preprocess, the user's fn runs on `undefined` because the *outer* schema invoked it (object accepting an absent key, or optional with `optin === "optional"` invoking the inner). The user's intent was "transform whatever input shows up," but they also wrapped in `.optional()` to say "absent input → absent output." `fallback` lets `.optional()` honor that.

Standalone transform (rare) gets the same treatment by virtue of also being marked.

## Walking through cases

Concrete shapes and what they evaluate to. Asterisks mark behaviors that depend on the in-flight branch.

```ts
// === Catch ===

z.string().catch("c").parse(undefined)
// → "c"  (catch fires on string(undefined) failure, fallback set, no outer reads it)

z.string().catch("c").parse(123)
// → "c"  (catch fires on string(123) failure)

z.string().catch("c").optional().parse(undefined)
// → undefined  (catch fires, fallback=true; handleOptionalResult clobbers on undef input)

z.string().catch("c").optional().parse("hi")
// → "hi"  (catch doesn't fire, no fallback)

z.string().catch("c").transform((s) => s + "!").optional().parse(undefined)
// → undefined  (catch fires, fallback propagates through pipe, optional clobbers)
//   pre-#5941: was "c!" because fallback was dropped at the pipe boundary

z.object({ a: z.string().catch("c") }).parse({})
// → { a: "c" }  (catch.optin = "optional" runtime; obj invokes catch with undefined; catch fires)

z.object({ a: z.string().catch("c") }).parse({ a: undefined })
// → { a: "c" }  (key present with undefined; catch fires on string(undefined))

z.object({ a: z.string().catch("c").optional() }).parse({})
// → {}  (key absent; optional clobbered the recovery value via fallback flag)

// === Default ===

z.string().default("d").parse(undefined)
// → "d"  (default short-circuits on undef input, returns d directly)

z.string().default("d").optional().parse(undefined)
// → "d"  (optional invokes default; default returns d; no fallback set; optional respects)

z.object({ a: z.string().default("d") }).parse({})
// → { a: "d" }  (default.optin = "optional"; obj invokes default; short-circuits to d)

// === Prefault ===

z.string().prefault("p").parse(undefined)
// → "p"  (prefault substitutes, runs inner string("p") which succeeds)

z.string().prefault("p").optional().parse(undefined)
// → "p"  (prefault doesn't set fallback — it's an absence handler, not recovery)

// === Preprocess ===*

z.preprocess((v) => v ?? "X", z.string()).parse(undefined)
// → "X"  (preprocess fn produces "X", inner string accepts)

z.preprocess((v) => v ?? "X", z.string()).optional().parse(undefined)
// → undefined  (transform sets fallback; optional clobbers on undef input)

z.object({ a: z.preprocess((v) => v ?? "X", z.string()) }).parse({})
// → { a: "X" }  (preprocess.optin = "optional" via transform; obj invokes; fn runs)
//   pre-branch: FAIL (4.4 regression after #5661 made obj parser strict)

z.object({ a: z.preprocess((v) => v ?? "X", z.string()).optional() }).parse({})
// → {}  (optional invokes preprocess; fn runs; fallback=true; optional clobbers; obj omits)

z.object({ a: z.preprocess((v) => v, z.string().optional()) }).parse({})
// → {}  (inner-optional preprocess; #5917/#5929 path)

// === Transform ===

z.string().transform((s) => s + "!").parse("hi")
// → "hi!"

z.string().transform((s) => s + "!").parse(undefined)
// → THROW  (string rejects undef before transform runs)

z.transform((v) => v ?? "X").parse(undefined)
// → "X"  (transform fn runs on undef, returns "X")

z.transform((v) => v ?? "X").optional().parse(undefined)
// → undefined  (optional invokes transform; fn runs; fallback=true; clobbers)

z.object({ a: z.transform((v) => v ?? "X") }).parse({})
// → { a: "X" }  (transform.optin = "optional" runtime; obj invokes transform with undef)

z.object({ a: z.string().transform((s) => s + "!") }).parse({})
// → THROW  (pipe.optin = string.optin = undefined — transform on OUT side doesn't drive optin)

z.object({ a: z.unknown().transform((v) => String(v ?? "X")).pipe(z.string()) }).parse({})
// → THROW  (outer pipe.optin = inner pipe.optin = unknown.optin = undefined — transform is
//   on the OUT side of the inner pipe, which is on the IN side of the outer pipe; the leading
//   `z.unknown()` drives optin and it's not "optional")
//
//   Compare to z.preprocess(fn, T):
//     z.preprocess(fn, T) === pipe(transform(fn), T)         — transform IS def.in of the only pipe
//     z.unknown().transform(fn).pipe(T) === pipe(pipe(unknown, transform), T)  — there's an
//                                                                                inner pipe with
//                                                                                z.unknown() on
//                                                                                the in side
//
//   Preprocess accepts absent because its leading position is the transform itself.
//   The unknown.transform.pipe(T) shape doesn't, because its leading position is z.unknown().
//   If you want preprocess-like absence-handling, use z.preprocess; if you specifically want
//   strict input typing on the leading slot, the unknown.transform.pipe shape gives that.

// === Coerce / unknown / any (intentionally strict on absent) ===

z.object({ a: z.coerce.string() }).parse({})
// → THROW  (coerce.string.optin = undefined; object rejects absent key)

z.object({ a: z.unknown() }).parse({})
// → THROW  (unknown.optin = undefined; soundness fix from 4.4)

z.object({ a: z.any() }).parse({})
// → THROW  (same)

// === Static type vs runtime divergence ===

z.input<typeof z.object({ a: z.string().catch("c") })>
// → { a: string }   — `a` is required at the type level

z.object({ a: z.string().catch("c") }).parse({})
// → { a: "c" }      — but accepts {} at runtime

z.input<typeof z.object({ a: z.preprocess(fn, T) })>
// → { a: <transform's input type> }   — `a` is required at the type level

z.object({ a: z.preprocess(fn, T) }).parse({})
// → { a: fn(undefined) }   — accepts {} at runtime
```

## Tuples

`$ZodTuple` mirrors `$ZodObject`'s logic for trailing positions. The same `optin`/`optout` flags drive whether a missing trailing slot is legal and whether to pad with explicit `undefined` vs trim.

The structurally-identical helper to `handlePropertyResult` for tuples is `handleTupleResult`. Same gate logic, same flag reads.

## What the public API workarounds look like

If you hit an absent-key rejection on a schema kind we intentionally keep strict (coerce, unknown, raw transform-on-the-out-side, etc.), the answer is to declare the absence explicitly:

```ts
// Want absence to be allowed on coerce? Wrap in optional:
z.object({ a: z.coerce.string().optional() }).parse({})
// → {}

// Want absence to map to a default?
z.object({ a: z.coerce.string().default("x") }).parse({})
// → { a: "x" }

// Want preprocess to fire on absent inner-required schemas? Use inner-optional:
z.object({ a: z.preprocess(fn, z.string().optional()) }).parse({})
// → {}  (or { a: fn(undefined) } if fn returns a defined value — depends on optional)
```

## History and rationale

| PR | What |
|---|---|
| [#5661](https://github.com/colinhacks/zod/pull/5661) | Made `$ZodObject` / `$ZodTuple` strict about absent slots — consult `optin`. Source of the 4.4 regressions. |
| [#5917](https://github.com/colinhacks/zod/pull/5917) / [#5929](https://github.com/colinhacks/zod/pull/5929) | Made preprocess defer optionality to inner schema (so `preprocess(fn, X.optional())` worked again). Pure metadata-override subtype design. |
| [#5937](https://github.com/colinhacks/zod/issues/5937) / [#5939](https://github.com/colinhacks/zod/pull/5939) | Restored `$ZodCatch.optin = "optional"` runtime + introduced the `caught` flag so an outer `$ZodOptional` could clobber catch's recovery. |
| [#5941](https://github.com/colinhacks/zod/pull/5941) | Renamed `caught → fallback`; propagated through `$ZodPipe` boundaries; also makes `$ZodPreprocess.optin = "optional"` and `$ZodTransform` set `fallback` on every invocation. Restores the bare-`preprocess` regression. **Plus** prototype commit promoting `optin = "optional"` from preprocess to transform (under consideration). |

## Design principle: flexible inputs, strict outputs (at runtime)

The static/runtime divergence pattern is not an accident — it captures a deliberate philosophy:

- **Static types stay strict.** `z.input<typeof schemaWithCatch>` shows the field as required. `z.input<typeof schemaWithPreprocess>` shows it as required. Users writing TypeScript see a contract that says "you must provide this key."

- **Runtime is flexible.** Catch handles failures including the failure of the inner schema to accept `undefined`. Preprocess and transform run their fns on whatever input shows up, including `undefined`. The runtime is more permissive than the type.

This is technically unsound — the runtime accepts inputs the type rejects — but it matches what users *expect* from these primitives. `.catch(default)` reads as "give me this when something goes wrong, including the absence of input." `z.preprocess(fn, T)` reads as "run this fn on whatever I get, including missing." Treating the static type as a stricter contract while the runtime is more accommodating is the ergonomic call.

The schemas where the input stays strict at runtime — `coerce`, `unknown`, `any`, plain `string`/`number`/etc. — don't have a user-written escape hatch. There's no reason for them to claim to handle absence; they should reject and let the user opt in explicitly. So the rule is: **schemas with a user-written escape hatch (catch's recovery, transform's fn) accept `undefined` at runtime; schemas without one don't.**

`fallback` is the runtime mechanism that makes this safe to combine with `optional`: when an outer wrapper *also* expresses an opinion about absent input ("missing → undefined"), the inner schema's escape-hatch output gets overridden. The user's explicit `.optional()` wins over the inner's "I happened to produce this value when called with undefined." Catch and transform both flag their output as fallback for this reason; default and prefault don't because their values are the deliberate output, not an escape-hatch output.

## Mental model (one paragraph)

A schema's `optin` declares whether it accepts absent input. Object and tuple parsers consult it before running. Optional consults it to decide whether to short-circuit or invoke the inner. Default, prefault, optional, and exact-optional all hardcode `optin = "optional"`. Catch and transform set it at runtime only — their static type doesn't claim to accept absence even though they do (flexible inputs, strict outputs). Preprocess inherits transform's runtime optin via pipe.

When `optional` wraps something with `optin === "optional"` and the input is `undefined`, it has to decide: *trust the inner's output*, or *override with `undefined`*. The `fallback` payload flag is how the inner tells the outer "this value is a recovery / a transform's interpretation, not a deliberate handling of absence — feel free to override." Catch sets it on substitution; transform sets it on every invocation. Default and prefault don't, because their values *are* the deliberate handling.

For everything else — `coerce`, `string`, `unknown`, `any`, `transform.pipe` shapes where transform is on the OUT side — `optin` stays `undefined`. Object and tuple parsers reject absent input. Users opt in explicitly via `.optional()` or `.default(...)` when they want absence accepted.
