# Recall Campaign Configuration Help Internationalization Design

## Problem

The recall campaign editor already renders the fixed-coupon currency warning through `t()`, but the English source string is absent from the locale catalogs. i18next therefore falls back to English for every locale:

> Stripe does not convert fixed Coupon amounts automatically. Configure each checkout currency explicitly.

Operators using a non-English interface must receive the same explanation in their selected language.

The audience template selector also lacks enough context for operators to understand what each template selects and how the rules below affect that selection. This makes campaign configuration unnecessarily error-prone.

## Scope

- Keep the existing English sentence as the flat i18n key, matching the console's current convention.
- Add a natural translation to all eight locale catalogs: English, Simplified Chinese, French, Russian, Japanese, Vietnamese, Spanish, and Portuguese.
- Add a compact explanation directly below the audience template selector and above the detailed audience rules.
- Show one common rule explanation plus a template-specific description that updates immediately when the selected template changes.
- Keep the current component structure, Stripe behavior, supported currencies, and form behavior unchanged apart from inserting the help copy.
- Do not modify legacy coupons or any backend API.

## Audience Template Help

The common explanation will state:

> Audience templates define the base audience. The rules below narrow it further, and every condition must match. Preview the audience before activation.

The selected template will add one of these descriptions:

| Template | Description |
| --- | --- |
| First purchase | Targets registered users who have never paid, for campaigns that encourage a first purchase. |
| Lapsed payer | Targets previous payers who have not paid or used the API recently. |
| Expired subscription | Targets previous subscribers whose subscription is no longer active and expired long enough ago. |

The explanation is informational only. It does not change field defaults, validation, audience queries, or preview behavior. All four source strings will receive natural translations in the same eight locale catalogs as the Stripe warning.

## Translations

| Locale | Text |
| --- | --- |
| `en` | Stripe does not convert fixed Coupon amounts automatically. Configure each checkout currency explicitly. |
| `zh` | Stripe 不会自动换算固定金额优惠券。请为每种结账货币分别配置减免金额。 |
| `fr` | Stripe ne convertit pas automatiquement les montants fixes des coupons. Configurez explicitement chaque devise de paiement. |
| `ru` | Stripe не конвертирует фиксированные суммы купонов автоматически. Настройте каждую валюту оплаты отдельно. |
| `ja` | Stripe はクーポンの固定割引額を自動換算しません。決済に使用する各通貨の割引額を個別に設定してください。 |
| `vi` | Stripe không tự động quy đổi số tiền giảm giá cố định của phiếu giảm giá. Hãy cấu hình riêng từng loại tiền tệ thanh toán. |
| `es` | Stripe no convierte automáticamente los importes fijos de los cupones. Configura explícitamente cada moneda de pago. |
| `pt` | A Stripe não converte automaticamente os valores fixos dos cupões. Configure explicitamente cada moeda de pagamento. |

## Validation

Add focused Bun tests beside the recall campaign feature. The tests will assert that the template-description mapping returns the appropriate source key when the selected template changes. They will also import all eight locale catalogs and assert that:

1. Every catalog contains the exact English source key.
2. Every value is non-empty.
3. Each non-English locale differs from the English fallback.

These catalog assertions apply to the Stripe warning, the common audience explanation, and all three template-specific descriptions.

Then run the focused tests, the i18n synchronization check, TypeScript type checking, and the production frontend build. This change is console-only and does not require a router deployment.
