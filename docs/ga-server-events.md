# GA4 Server-Side Events

This deployment sends selected business events to Google Analytics 4 through Measurement Protocol.

## Runtime configuration

- Measurement ID: `GA_MESSUREMENT_ID`
  - Current value: `G-30RCEP2CVH`
  - The misspelled environment key is intentional because the GitHub Actions secret uses this name.
- Measurement Protocol API secret: `GA_MEASURE_PROTOCOL_API_SECRET`
  - Stored in GitHub Actions secrets.
  - The value is injected into Cloud Run by `.github/workflows/gcp-deploy.yml`.

If `GA_MEASURE_PROTOCOL_API_SECRET` is empty, server-side GA sends are skipped and the user flow continues normally.

## Identity fields

The frontend reads GA cookies and sends these fields to the backend:

- `ga_client_id`: from `_ga`, for example `1234567890.1234567890`
- `ga_session_id`: from `_ga_30RCEP2CVH`, parsed from the GA4 session cookie

Registration sends these fields directly. Payment flows save them on the local `TopUp` order so webhook completion can send the event later with the same browser identity.

## Events

### `sign_up_success`

Sent when a new user account is created successfully.

Parameters:

- `user_id`
- `method`: `password` or the OAuth provider prefix
- `inviter_id`: only present when the signup used an invite code
- `session_id`
- `engagement_time_msec`

### `invite_sucess`

Sent when a new user registers successfully through an invite link.

Note: the event name intentionally uses `sucess` to match the requested GA event name.

Parameters:

- `user_id`
- `method`
- `inviter_id`
- `session_id`
- `engagement_time_msec`

### `payment_success`

Sent when a wallet top-up order transitions from pending to successful payment.

Parameters:

- `user_id`
- `trade_no`
- `payment_method`
- `payment_provider`
- `value`: actual paid amount from the local top-up order
- `currency`: order currency, defaulting to `USD` when the gateway did not store one
- `session_id`
- `engagement_time_msec`

## Failure behavior

GA delivery is best-effort. A failed GA request is logged as a warning and never blocks registration, invite rewards, payment crediting, or webhook acknowledgements.
