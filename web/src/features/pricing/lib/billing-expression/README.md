# Front-end billing expression specification

The front-end shares expression semantics, and each entrance retains its own display strategy. backend
`pkg/billingexpr` is the actual deduction basis; browser simulation does not modify the configuration, does not send requests, and does not deduct fees.

## Three different abilities

1. **Executable**: The expression is supported by parsers and interpreters and the required context is provided.
2. **Structured display**: The entire expression conforms to the price shape accepted by the corresponding display adapter.
3. **Visual Editing**: Existing forms can be expressed losslessly and regenerated.

These three abilities cannot be inferred from each other. `max(p * 2, 100)` can be simulated but cannot be extracted as input unit price 2.
Unknown request parameters cannot be replaced with an empty object, zero, false, or the default gear.

## Interface and data flow

- `compileBillingExpression(source)`: Return `ready` (source text, AST, dependency, rule location) or failure result with diagnostics.
- `evaluateBillingExpression(sourceOrCompiled, context)`: Returns `success` (`cost`, `matchedTier`, `requestRules`), or `invalid` / `unsupported` / `missing_context`.
- `display.ts`: Only recognizes the complete standard token ladder, the task enumeration ladder supported by the schema, and the time branch in the outer layer of the standard ladder. The branch in the task ladder that references the schema without declaring an enumeration value is considered unreachable and skipped, and the other gears are identified as usual; `task-display.ts` treats this type of comparison as always untrue.
- `structure.ts`: lossless splitting of top-level expressions; parentheses, operators, and escapes within strings are not treated as expression structures.
- `condition-display.ts`: Convert week ranges, hour ranges, condition combinations and complements from AST to localized descriptions. Details, grouping tables, logs and simulation rules are shared; the original source code only falls back on unrecognized conditions.
- `visual.ts`: `parseVisualBillingDocument(source)` converts AST into conditional branches and price leaves; `serializeVisualBillingDocument(document)` returns complete source code or field errors, but does not return incomplete expressions. The document retains the source code, node identity, source interval, variable existence and string draft; modifications are identified and partially replaced by comparing with the source node.
- The original `billing-expr.ts`, `tier-expr.ts`, and `task-expr.ts` are compatible entries. The presentation adapter preserves field names, order, cost units, and fallback values.

Compiled results are cached as raw strings, retaining up to 128 items. A new execution state is created for each evaluation, and gear, time cache, and rule hits will not be leaked to other requests.
Does not use `eval` or `new Function`, does not parse JavaScript object members, and does not access global objects.

`BillingSimulationContext`：

```ts
{
  tokens?: Partial<Record<TokenVariable, number>>
  request?: { body?: unknown; headers?: Record<string, string> }
  usage?: Record<string, unknown>
  now?: Date
}
```

- `tokens` is a normalized billing variable; the emulator does not cache it again. `p`, `c` have the same meaning as existing estimate inputs.
- The basic estimated `len` defaults to `p + cr + cc + cc1h + cc12h` and can be explicitly overridden; the token is not inferred from the request JSON.
- When the expression prices `cc` but does not price `cc1h` or `cc12h`, the basic estimate is the same as the backend. 6/3.75 times of 1-hour writes and 2 times of 12-hour writes are included in `cc`. When `cc` itself is not priced, these writes are not charged.
- Omitting `request` indicates that there is no simulated request context; explicit `{}` indicates a request without request headers and request body fields. Only after request simulation is enabled, the interface provides empty requests.
- `usage` corresponds to the task `u()` field; the task usage is not guessed from the request body.
- `now` is the absolute time shared by an evaluation. If omitted, the current time will be obtained when the evaluation starts.
- The input token must be a finite non-negative number. If the execution fails, the available fee will not be returned, and the error will not be replaced with 0.

## Support syntax and backend semantics

Supports default version and `v1:`, decimal numbers and scientific notation, single/double quoted strings and common escapes, `true` / `false` / `nil`, brackets, `+ - * / %`, comparisons, `!`, `&&`, `||` and ternary conditions.

Functions: `tier`, `param`, `header`, `has`, `u`, `hour`, `minute`, ORBITCODE 7TOKEN, `month`, `day`, `min`, `max`, `abs`, `ceil`, `floor`.

- Short-circuit execution of logical operations and conditional branches; the condition must be a Boolean value, and the truthy rules of JavaScript are not used.
- There is no JavaScript implicit conversion between numbers and strings. Division returns a numerical value; modulo requires integer operands, and token and JSON values ​​are processed according to back-end floating point semantics.
- The `param` path removes leading and trailing blanks first; supports `a.b`, `items.0.price`, escape keys and `items.#` length. Not present and JSON null return `nil`; explicit zero, false, and empty strings retain their original values.
- Request header names ignore case, and names and values remove leading and trailing blanks; empty names and values are skipped, and empty strings are returned if they do not exist.
- `has` distinguishes between empty substrings and nil; the JSON container uses the backend `fmt.Sprint` representation.
- `u` reads explicit task facts, missing fields return nil, missing entire task context reports `missing_context`.
- Five time functions are evaluated in the IANA time zone specified by the expression. Hour 0–23, Minute 0–59, Sunday 0, Month 1–12. Empty or invalid time zone falls back to UTC. `Local` relies on the server process time zone, which is clearly not supported by the browser.
- Rule track follows the backend: Only ternary nodes whose conditions include request/time probes, two branches are numerical literals, and fallback is 1 are recorded. Rules that are skipped by short-circuiting are left unmatched.

The full Expr language and full GJSON are not supported: advanced queries, pipes, wildcards, arbitrary functions, and object operations report that they cannot be mocked; the original expression remains. Integer operations beyond JavaScript's safe integer precision are not claimed to be equivalent to Go. There are limits on expression length, number of tokens, and depth, and will be downgraded if limits are exceeded.

## Amount unit

The interpreter returns the original expression value, without currency, grouping or recharge ratio conversion**.

- Token: Only divide `1_000_000` once when displaying a single cost.
- Task: The expression has returned a single cost and cannot be divided whole by millions. The `/ 1000000` of the task token field belongs to the expression itself.
- The display still formats the chain through the existing currency, recharge ratio, and grouping ratio. The front-end simulation does not calculate the actual amount rounding and saturation.

## Show entry contract

| Entrance | Reserved Rules |
| -------------------------- | ---------------------------------------------------------------------- |
| Square card, list price, cache price | For unselected groups, the lowest available magnification will be taken; for selected groups, the group will be taken; legal zero magnification is valid |
| Token summary | Take the first file and the original field order; do not calculate the lowest price across files or the common range |
| Request additional multipliers | Base price separate from additional rules, including independent time multipliers |
| Task summary | The last level is the basic value; the field-by-field range is used; free level participation, the same price does not display the range |
| Details Base Price | Multiply 1 |
| Detailed grouping table, complete details | Display all gears, conditions and groupings without replacing them with the current period summary |
| Task matrix, examples | Retain the original matrix, unique complement and example selection; public examples exclude request magnification |
| Usage log | Back-end gear, rule track priority; retained tag priority, usage facts to assist matching; unknown tags do not guess the price |
| Visual editing, snapshots, price synchronization | Only lossless conversion, retaining the original text and original rollback |
| Special expressions, unconfigured prices | Keep special expressions and empty states, do not extract local prices |

The new time branch adapter only accepts outer conditions that only depend on time, and the inner part of the branch is the shape of the existing standard token ladder.
The summary filters the time branches according to the current time, and then takes the first file according to the original rules. Even if the first gear is more expensive, you will not switch to other gears.
Conditions containing unknown request parameters are not automatically expanded into ranges.

`getDynamicPricingTiers` and `parseTiersFromExpr` return the full gear;
`getCurrentTimePricingTiers` is for real-time summaries only. The time condition text is passed to the details and logs with the complete gear.
Conditional display retains the original time zone identifier (such as `Asia/Shanghai`) and does not translate it into place names; Chinese weekdays and time ranges use "to".
`useBillingTime` shares a minute clock and is updated when the minute boundary and page visibility change; no time dependency and no subscription.
The log is not subscribed to this clock.

## Editor conventions

The original basic estimation retains the caliber of excluding request additional magnification and excluding group magnification.
The stand-alone "Request Simulation" panel evaluates the full expression, including the request rule, still excluding the grouped magnification.
The request body uses `JsonCodeEditor`, and the request header uses the string mapping mode of `JsonEditor`.
The specified time must be an ISO date-time with a time zone offset; incorrect entry invalidates the current simulation results.

Boolean task usage uses the selection control corresponding to the schema in the request simulation panel, retaining the true/false type; the identification rules of the original task matrix will not be modified.

The request context only exists in the interface state. Preview and time refresh do not call the configuration update callback.
Original expressions that cannot be converted losslessly cannot be switched to the default visual price overlay of the original text.

The Token editor gives priority to using the original ladder form; when the old form cannot be carried, the conditional tree document is used.
Does not change the return meaning of `tryParseVisualConfig` or price sync callers.
The old form was generated with the zero price of the extra variable omitted, so single files with an explicit zero cache price also used the document form.

Conditional tree editing supports:

- Any parser-depth-limited combination of `&&`, `||`, `!`, five time functions and comparisons of `p`, `c`, `len` with non-negative finite numbers; time values must be integers.
- Continue to nest token ladders within conditional branches; otherwise, the branch is the complement of the previous condition, and conditions that may overlap or be missed are not written separately.
- Standard `tier(name, variable * price + ...)` token price leaf, and `tier(name, fixed(amount))` pay-per-view price leaf; the same condition tree can mix the two billing methods. Each token variable can be used at most once, supporting any order of price items and individual prices.
- Paired start and end conditions reuse interval input, retaining `>`, `>=`, `<`, and `<=` respectively; use "Any Satisfaction" across midnight. End of hour boundary supports `< 24`. Other comparisons are still entered in independent terms.
- Gear names are saved as string escapes; missing variables are not interchangeable with explicit `cr * 0`. The currency only converts the price field and does not change the time period, token threshold or additional request multiplier.

Mode switching, currency switching, simulation and direct saving retain the original expression when not edited.
When prices or conditions change, only the corresponding source code range is replaced; when the structure changes, the affected subtree is rebuilt and the brackets are retained.
Additional request rules use independent source code status and are regenerated only when request rules are edited. Time and price scales are not converted into request ratios.
Add a new billing branch to copy the current price to both sides of the condition is true and otherwise, and the condition is initially left blank.
The price area of the simple ladder and condition tree can be switched to "by token / per time", and the switch retains the local price draft of another method.
Leave the new pay-per-view price blank and prevent saving. Explicitly enter `0` to mean it is free; the storage amount is always USD.
The pay-per-view price does not scale with the 1K/1M token display unit, and the mixed billing summary and details are marked with separate units.
The logs preferentially use the `billing_unit` and `fixed_price` recorded in the backend. The highlighting of branches with the same name also checks the billing unit and fixed price.
Empty condition groups, illegal numbers, invalid new time zones, and drafts that fail to compile display errors and prevent saves and mode switches, retaining the last valid configuration.
Existing time zone identifiers from the original text and their backend fallback semantics remain unchanged; newly entered time zones must be valid IANA identifiers.

The condition tree follows the existing input, selector and menu components of the project, and uses light background colors of blue (all satisfied), purple (any satisfied), amber (inverted), group numbers and connecting lines to indicate ownership; ordinary conditions are kept in a compact single line, and adjacent start and end comparisons within the group can be combined and displayed. Merging only affects form rendering and does not create or rewrite AST groups when not edited. Additional operations are included in the menu, and if the condition is met or otherwise, the result directly indicates the target gear.

Expressions beyond the above editing shapes such as `min`, `max`, non-linear prices, repeated variables, request parameter conditions, etc. will still retain the original text.
Calculable or displayable does not mean visual editing; conditional editing and price summary each maintain the existing condition identification boundaries, and both support fixed price leaves.

## Regression verification

- Go and the browser read the same set of contract samples `pkg/billingexpr/testdata/frontend_simulation.json`.
- The audio conversion example binds the backend to generate input through `conversion`, and simultaneously verifies the branch and price display through `displayTiers`; changes to the conversion template must update the contract simultaneously. Limited equivalent AST variants (parentheses, `max` parameter order, price multiplication left and right order, audio OR order) maintain the same presentation.
- Time test fixes absolute time, covering peak boundaries, weekends, midnight cross-month and daylight saving time.
- The business expectations of the original prices, groups, tasks, logs, editors, and synchronous testing remain unchanged.
- Component testing covers the explicit opening of the request panel, JSON/time errors, magnification results, unchanged units, configuration, and card time refresh.
- Don't use full DOM snapshots, web services, or the browser's current actual time as calculation expectations.
