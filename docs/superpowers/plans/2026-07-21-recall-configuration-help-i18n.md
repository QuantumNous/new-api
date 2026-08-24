# Recall Configuration Help Internationalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize the fixed-coupon warning and add localized, dynamic explanations for recall audience templates.

**Architecture:** Keep display copy in the existing recall campaign editor and store the three dynamic audience-description keys in a small typed mapping beside the feature. A focused Bun test locks the mapping and verifies that every new source key has a real translation in all eight locale catalogs.

**Tech Stack:** React 19, TypeScript 6, react-i18next, Bun test, Rsbuild

---

## File Structure

- Create `web/default/src/features/recall-campaigns/copy.ts`: typed mapping from each audience template to its English i18n source key.
- Create `web/default/src/features/recall-campaigns/copy.test.ts`: mapping behavior and eight-locale translation coverage.
- Modify `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`: render the common explanation and the selected template description.
- Modify `web/default/src/i18n/static-keys.ts`: register the three mapping values because the extractor cannot see keys passed to `t()` dynamically.
- Modify `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi,es,pt}.json`: add the fixed-coupon warning and four audience-help strings.

### Task 1: Lock the expected audience-description mapping

**Files:**
- Create: `web/default/src/features/recall-campaigns/copy.test.ts`
- Create: `web/default/src/features/recall-campaigns/copy.ts`

- [ ] **Step 1: Write the failing mapping test**

Create `copy.test.ts` with a table-driven assertion:

```ts
import { describe, expect, test } from 'bun:test'
import { audienceTemplateDescriptionKeys } from './copy'

describe('recall campaign copy', () => {
  test('maps each audience template to its explanation', () => {
    expect(audienceTemplateDescriptionKeys).toEqual({
      first_purchase:
        'Targets registered users who have never paid, for campaigns that encourage a first purchase.',
      lapsed_payer:
        'Targets previous payers who have not paid or used the API recently.',
      expired_subscription:
        'Targets previous subscribers whose subscription is no longer active and expired long enough ago.',
    })
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run from `web/default`:

```bash
bun test src/features/recall-campaigns/copy.test.ts
```

Expected: FAIL because `./copy` does not exist yet.

- [ ] **Step 3: Add the minimal typed mapping**

Create `copy.ts`:

```ts
import type { RecallAudienceTemplate } from './types'

export const audienceTemplateDescriptionKeys: Record<
  RecallAudienceTemplate,
  string
> = {
  first_purchase:
    'Targets registered users who have never paid, for campaigns that encourage a first purchase.',
  lapsed_payer:
    'Targets previous payers who have not paid or used the API recently.',
  expired_subscription:
    'Targets previous subscribers whose subscription is no longer active and expired long enough ago.',
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `bun test src/features/recall-campaigns/copy.test.ts`

Expected: 1 test passes.

- [ ] **Step 5: Commit the mapping**

Commit with the Lore intent `Explain who each recall audience template selects`, `Confidence: high`, `Scope-risk: narrow`, and `Tested: bun test src/features/recall-campaigns/copy.test.ts`.

### Task 2: Lock and add all locale translations

**Files:**
- Modify: `web/default/src/features/recall-campaigns/copy.test.ts`
- Modify: `web/default/src/i18n/static-keys.ts`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/pt.json`

- [ ] **Step 1: Extend the test with locale coverage**

Import all eight catalogs, define the five keys below, and for each locale assert own-property presence, a truthy value, and a value different from the source key when the locale is not `en`:

```ts
const recallHelpKeys = [
  'Stripe does not convert fixed Coupon amounts automatically. Configure each checkout currency explicitly.',
  'Audience templates define the base audience. The rules below narrow it further, and every condition must match. Preview the audience before activation.',
  ...Object.values(audienceTemplateDescriptionKeys),
] as const
```

- [ ] **Step 2: Run the test and verify RED**

Run: `bun test src/features/recall-campaigns/copy.test.ts`

Expected: FAIL with the first missing locale key.

- [ ] **Step 3: Add exact English and Chinese values**

Add the five English keys with identity values to `en.json`. Add these values to `zh.json`:

```text
Stripe 不会自动换算固定金额优惠券。请为每种结账货币分别配置减免金额。
受众模板决定基础受众。下方规则会进一步缩小范围，且必须满足全部条件。激活前请先预览受众。
筛选从未付费的注册用户，适用于推动首次购买的活动。
筛选曾经付费、但近期没有付款或使用 API 的用户。
筛选曾经订阅、当前没有有效订阅且已过期足够长时间的用户。
```

- [ ] **Step 4: Add French, Russian, Japanese, Vietnamese, Spanish, and Portuguese values**

Add the five values in source-key order (Stripe warning, common help, first purchase, lapsed payer, expired subscription):

| Locale | Values |
| --- | --- |
| `fr` | `Stripe ne convertit pas automatiquement les montants fixes des coupons. Configurez explicitement chaque devise de paiement.`<br>`Les modèles d’audience définissent l’audience de base. Les règles ci-dessous la restreignent davantage, et toutes les conditions doivent être remplies. Prévisualisez l’audience avant l’activation.`<br>`Cible les utilisateurs inscrits qui n’ont jamais payé, pour les campagnes visant à encourager un premier achat.`<br>`Cible les anciens clients qui n’ont pas payé ni utilisé l’API récemment.`<br>`Cible les anciens abonnés dont l’abonnement n’est plus actif et a expiré depuis suffisamment longtemps.` |
| `ru` | `Stripe не конвертирует фиксированные суммы купонов автоматически. Настройте каждую валюту оплаты отдельно.`<br>`Шаблоны аудитории определяют базовую аудиторию. Правила ниже дополнительно сужают её, и должны выполняться все условия. Перед активацией просмотрите аудиторию.`<br>`Отбирает зарегистрированных пользователей, которые ещё ни разу не платили, для кампаний, стимулирующих первую покупку.`<br>`Отбирает прежних плательщиков, которые в последнее время не платили и не использовали API.`<br>`Отбирает прежних подписчиков, чья подписка больше не активна и истекла достаточно давно.` |
| `ja` | `Stripe はクーポンの固定割引額を自動換算しません。決済に使用する各通貨の割引額を個別に設定してください。`<br>`オーディエンステンプレートは基本の対象者を定義します。以下のルールでさらに対象を絞り込み、すべての条件を満たす必要があります。有効化する前に対象者をプレビューしてください。`<br>`初回購入を促すキャンペーン向けに、登録済みで一度も支払いをしていないユーザーを対象とします。`<br>`過去に支払い実績があり、最近は支払いや API 利用がないユーザーを対象とします。`<br>`過去に購読しており、現在は有効な購読がなく、失効から一定期間が経過したユーザーを対象とします。` |
| `vi` | `Stripe không tự động quy đổi số tiền giảm giá cố định của phiếu giảm giá. Hãy cấu hình riêng từng loại tiền tệ thanh toán.`<br>`Mẫu đối tượng xác định nhóm đối tượng cơ bản. Các quy tắc bên dưới sẽ thu hẹp thêm phạm vi và người dùng phải đáp ứng tất cả điều kiện. Hãy xem trước đối tượng trước khi kích hoạt.`<br>`Nhắm đến người dùng đã đăng ký nhưng chưa từng thanh toán, phù hợp với chiến dịch khuyến khích mua lần đầu.`<br>`Nhắm đến người dùng từng thanh toán nhưng gần đây không thanh toán hoặc sử dụng API.`<br>`Nhắm đến người dùng từng đăng ký gói, hiện không còn gói đăng ký đang hoạt động và đã hết hạn đủ lâu.` |
| `es` | `Stripe no convierte automáticamente los importes fijos de los cupones. Configura explícitamente cada moneda de pago.`<br>`Las plantillas de audiencia definen la audiencia base. Las reglas siguientes la reducen aún más y deben cumplirse todas las condiciones. Previsualiza la audiencia antes de activar la campaña.`<br>`Se dirige a usuarios registrados que nunca han pagado, para campañas que fomentan una primera compra.`<br>`Se dirige a antiguos clientes que no han pagado ni utilizado la API recientemente.`<br>`Se dirige a antiguos suscriptores cuya suscripción ya no está activa y venció hace suficiente tiempo.` |
| `pt` | `A Stripe não converte automaticamente os valores fixos dos cupões. Configure explicitamente cada moeda de pagamento.`<br>`Os modelos de público definem o público-base. As regras abaixo restringem-no ainda mais, e todas as condições têm de ser cumpridas. Pré-visualize o público antes da ativação.`<br>`Destina-se a utilizadores registados que nunca pagaram, para campanhas que incentivam uma primeira compra.`<br>`Destina-se a antigos clientes que não pagaram nem utilizaram a API recentemente.`<br>`Destina-se a antigos subscritores cuja subscrição já não está ativa e expirou há tempo suficiente.` |

Add the three dynamic description keys to `STATIC_I18N_KEYS` under a `Recall campaign audience help` comment.

- [ ] **Step 5: Run locale checks and verify GREEN**

Run:

```bash
bun test src/features/recall-campaigns/copy.test.ts
bun run i18n:sync
```

Expected: the test passes and the synchronization command reports no missing new recall-help translation.

- [ ] **Step 6: Commit locale coverage**

Commit with the Lore intent `Keep recall configuration guidance understandable in every locale`, `Confidence: high`, `Scope-risk: narrow`, and the two commands above in `Tested:`.

### Task 3: Render dynamic audience help in the editor

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`

- [ ] **Step 1: Add a failing rendered-output test**

Create `components/campaign-editor.test.tsx`. Initialize an English i18next instance, wrap `CampaignEditor` in `I18nextProvider` and `QueryClientProvider`, render it with `renderToStaticMarkup`, and assert that the HTML contains both the common-help sentence and the first-purchase description. Run the test and confirm it fails because the editor does not yet render those sentences.

```tsx
import { beforeAll, describe, expect, test } from 'bun:test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { CampaignEditor } from './campaign-editor'

const commonHelp =
  'Audience templates define the base audience. The rules below narrow it further, and every condition must match. Preview the audience before activation.'
const firstPurchaseHelp =
  'Targets registered users who have never paid, for campaigns that encourage a first purchase.'
const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          [commonHelp]: commonHelp,
          [firstPurchaseHelp]: firstPurchaseHelp,
        },
      },
    },
    interpolation: { escapeValue: false },
  })
})

describe('CampaignEditor audience help', () => {
  test('explains the selected audience before its rules', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={testI18n}>
          <CampaignEditor />
        </I18nextProvider>
      </QueryClientProvider>
    )

    expect(html).toContain(commonHelp)
    expect(html).toContain(firstPurchaseHelp)
  })
})
```

- [ ] **Step 2: Insert the help block**

Import `audienceTemplateDescriptionKeys` and add this block immediately after the audience template selector container, so it spans both columns and remains above the audience-rules card:

```tsx
<div className='bg-muted/50 text-muted-foreground space-y-1 rounded-md p-3 text-sm md:col-span-2'>
  <p>
    {t(
      'Audience templates define the base audience. The rules below narrow it further, and every condition must match. Preview the audience before activation.'
    )}
  </p>
  <p className='text-foreground'>
    {t(audienceTemplateDescriptionKeys[audienceTemplate])}
  </p>
</div>
```

- [ ] **Step 3: Verify the rendered guidance and focused behavior**

Run:

```bash
bun test src/features/recall-campaigns/copy.test.ts
bun test src/features/recall-campaigns/components/campaign-editor.test.tsx
```

Expected: all mapping, locale, and rendered editor tests pass.

- [ ] **Step 4: Commit the editor help**

Commit with the Lore intent `Prevent audience mistakes while configuring recall campaigns`, `Confidence: high`, `Scope-risk: narrow`, and both focused Bun tests in `Tested:`.

### Task 4: Verify, publish, and promote to staging

**Files:**
- No production files beyond Tasks 1-3.

- [ ] **Step 1: Run targeted and repository checks**

Run from `web/default`:

```bash
bun test src/features/recall-campaigns/copy.test.ts
bun test src/features/recall-campaigns/components/campaign-editor.test.tsx
bun test
bun run typecheck
bun run build
```

Expected: all commands exit 0 without new warnings attributable to this change.

- [ ] **Step 2: Check scope and worktree state**

Run from the repository root:

```bash
git diff origin/main...HEAD --stat
git status --short
```

Expected: only recall feature, locale, documentation, and related test changes are present; the worktree is clean.

- [ ] **Step 3: Push the feature branch and update PR 453**

Push `feature/stripe-user-winback`, verify PR 453 points at the new head, and add a PR note describing the localized warning, dynamic audience guidance, validation evidence, and console-only deployment impact.

- [ ] **Step 4: Promote only the verified commits to staging**

Update `staging` from `origin/staging`, cherry-pick only the implementation commits from Tasks 1-3, push `staging`, monitor the staging workflow, and verify the recall campaign editor in at least English and Chinese. Do not modify or merge `main`.
