# Model Pricing Display

This context describes how users read token-based model prices that change with time.

## Pricing Terms

**Time-dependent tier**:
A named token-pricing tier selected by a time condition in the model's billing expression.
_Avoid_: peak tier (unless the tier is specifically the peak period)

**Current tier**:
The time-dependent tier whose condition matches the current instant in the timezone specified by the billing expression.
_Avoid_: server-local tier, browser-local tier
