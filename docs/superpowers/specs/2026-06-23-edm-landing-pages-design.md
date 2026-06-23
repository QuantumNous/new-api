# EDM Landing Pages Design

Date: 2026-06-23
Branch: `feat/edm-landing-page`

## Goal

Create three EDM-only landing pages for Flatkey. These pages are for direct email traffic, not organic SEO. Each page should make the offer obvious within the first viewport and drive the visitor to create a Flatkey API key.

Primary CTA for all pages:

```text
https://console.flatkey.ai/sign-up?redirect=/keys
```

Implementation must build this through the existing console origin helper, not by hardcoding `console.flatkey.ai`, so environment-driven cross-app wiring stays intact.

## Pages

### 1. Personal AI Savings

Path:

- `/lp/personal-ai`
- localized variants through existing locale routing, for example `/zh/lp/personal-ai`

Audience:

Individuals using AI tools frequently who care about lower token cost, broader model access, and non-expiring prepaid value.

Core offer:

- Tokens are at least 40% cheaper.
- Recharge `$20`, get `$5` bonus.
- Higher recharge tiers offer larger bonuses, such as `$200` with a larger bonus.
- Position this as roughly comparable to buying a non-expiring GPT 3x-style plan, while also unlocking many well-known models through one key.

Support content:

- One key for common model APIs.
- Works with coding tools such as Codex and Claude Code.
- Clear starter path: create a key, add balance, test with a small workload.

Proof:

- Use the provided OpenAI 10B token usage plaque photo as a trust artifact.
- Copy should say Flatkey has received OpenAI recognition for passing 10 billion tokens.
- Claim model quality through official upstream tokens; avoid suggesting unofficial or degraded routing.

### 2. CTO AI Cost Savings

Path:

- `/lp/cto-ai-savings`
- localized variants through existing locale routing, for example `/zh/lp/cto-ai-savings`

Audience:

CTOs, engineering leaders, founders, and technical buyers who already have product AI usage, developer AI usage, or quota pressure.

Core offer:

- Cut company AI API and engineering AI tool cost by at least 40%.
- Start with `$20 + $5 bonus` to validate routing, quality, logs, and usage.
- After validation, contact Flatkey for larger team or package pricing.

Use cases:

- Add AI capabilities to an existing system.
- Reduce developer-agent cost for Codex, Claude Code, and similar workflows.
- Reduce friction from official quota limits.

Proof:

- Use the same OpenAI 10B token usage plaque photo.
- Explain that Flatkey's own development workflow is powered by Flatkey-provided AI usage, so the product is proven in daily internal engineering work.
- Include trust signals already used by the public site where appropriate, such as existing security badges, but keep the page short.

### 3. Image Buddy For Operators

Path:

- `/lp/image-buddy`
- localized variants through existing locale routing, for example `/zh/lp/image-buddy`

Audience:

Operators, marketers, ecommerce teams, and content teams who repeatedly need usable campaign images but lose time on prompt writing and generation limits.

Core offer:

- Use Flatkey to unlock lower-cost image generation and reduce quota friction.
- Use the Image Buddy skill/workflow to turn reusable prompts into campaign images.
- Create a Flatkey key first, then install Image Buddy.

Support content:

- Pain points: repeated image creation, prompt hunting, quota limitations, inconsistent output.
- Benefits: reusable prompt templates, quicker image generation, one key for generation workflow.
- Secondary link to installation docs: `https://github.com/flatkey-ai/awesome-images`.

Proof:

- Mention Flatkey's OpenAI 10B token recognition as trust proof.
- Reuse existing Image Buddy assets from `website/public/use-case/image-buddy/` where useful.

## Shared Page Structure

Each page should use a direct conversion layout:

1. Slim brand header with Flatkey logo and one CTA.
2. Hero section with audience-specific headline, short supporting copy, offer badge, and primary CTA.
3. Trust/proof block using the OpenAI 10B token plaque image.
4. Three evidence cards tied to the audience's buying reason.
5. Short "how to start" section with two or three steps.
6. Minimal FAQ focused on objections.
7. Final CTA.

Avoid full marketing-site navigation. These are campaign pages, so the path should stay focused on key creation.

## Visual Direction

Use Direct Offer style:

- Clear value headline.
- High-contrast CTA.
- Real proof artifact instead of abstract decoration.
- Professional, light, conversion-oriented layout.
- Avoid heavy gradients, generic AI glow, card-heavy clutter, or oversized editorial styling.

The OpenAI plaque image should be cropped to keep the plaque readable and the office background secondary. It should feel real, not stock-like.

## SEO And Indexing

These pages are EDM-only:

- Add metadata with `noindex` and `nofollow`.
- Do not add them to `website/src/app/sitemap.ts`.
- Add `/lp/` to `website/src/app/robots.ts` disallow rules.
- Do not add them to header navigation, footer navigation, or public SEO page lists.

Localized pages can still have alternates for user language routing, but robots must prevent indexing.

## Internationalization

The website uses root English plus localized paths for the supported locales. These pages must provide true localized copy for all existing website locales:

- `en`
- `zh`
- `es`
- `fr`
- `pt`
- `ru`
- `ja`
- `vi`
- `de`

Do not copy English text into non-English locales except for product names, URLs, model/tool names, and other literals.

## Technical Shape

Expected implementation:

- Add a reusable `EdmLandingPage` component under `website/src/components/`.
- Add page configuration/copy under `website/src/lib/` or `website/src/content/`, following existing website patterns.
- Add English routes under `website/src/app/lp/.../page.tsx`.
- Add localized routes under `website/src/app/[locale]/lp/.../page.tsx`.
- Use `buildMetadata({ noIndex: true })`.
- Use `consoleUrl("/sign-up?redirect=/keys")` or an equivalent env-driven helper call.
- Keep all code inside `website/`.

## Multi-Node Behavior

This is a static/SSR website change only. It does not touch billing, quota, auth, relay routing, caches, background jobs, or database writes. Production multi-node correctness is not relevant beyond normal stateless Next.js rendering.

## Validation

Before completion:

- Run `cd website && bun run lint`.
- Run `cd website && bun run typecheck`.
- Run `cd website && bun run build`.
- Check rendered pages locally or with a production build server.
- Confirm `robots.txt` disallows `/lp/`.
- Confirm `sitemap.xml` does not include `/lp/personal-ai`, `/lp/cto-ai-savings`, or `/lp/image-buddy`.
- Confirm each page has `noindex,nofollow` metadata.
- Confirm CTA href resolves from configured console origin and points to `/sign-up?redirect=/keys`.
