/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import * as React from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { removeTrailingSlash } from './utils'

// The form schema describes only what the operator types directly. Save is
// the single point where any of this lands in the OptionMap — intermediate
// API calls (catalog, create-store, create-product) pass these values
// transiently in the request body.
const waffoPancakeSchema = z.object({
  WaffoPancakeMerchantID: z.string(),
  WaffoPancakePrivateKey: z.string(),
})

export type WaffoPancakeSettingsValues = z.infer<typeof waffoPancakeSchema> & {
  WaffoPancakeReturnURL: string
}

interface Props {
  defaultValues: WaffoPancakeSettingsValues
  provisionedStoreID?: string
  provisionedProductID?: string
}

interface CatalogProduct {
  id: string
  name: string
  status: string
}

interface CatalogStore {
  id: string
  name: string
  status: string
  prodEnabled: boolean
  onetimeProducts: CatalogProduct[]
}

interface BackendBody<T> {
  message?: string
  data?: T | string
}

const PANCAKE_DASHBOARD_URL = 'https://pancake.waffo.ai/dashboard'
const DEFAULT_NEW_STORE_NAME = 'new-api-store'
const DEFAULT_NEW_PRODUCT_NAME = 'new-api-charge-product'
const DEFAULT_NEW_PAIR_NAME = `${DEFAULT_NEW_STORE_NAME} + ${DEFAULT_NEW_PRODUCT_NAME}`

export function WaffoPancakeSettingsSection(props: Props) {
  const { t } = useTranslation()

  // Persisted state surfaced from props — these reflect what's currently
  // committed in the OptionMap, so the operator can see at a glance what
  // the next Waffo Pancake top-up will route through.
  const [storeID, setStoreID] = React.useState(
    props.provisionedStoreID ?? ''
  )
  const [productID, setProductID] = React.useState(
    props.provisionedProductID ?? ''
  )

  // Transient UI state — everything below this comment lives in React only,
  // never auto-PUT to the backend, until the operator clicks Save.
  const [phase, setPhase] = React.useState<'idle' | 'verifying' | 'saving'>(
    'idle'
  )
  const [catalog, setCatalog] = React.useState<CatalogStore[]>([])
  // Seed from saved bindings so the dropdowns render the operator's existing
  // selection on page refresh — without waiting for the async catalog fetch
  // to finish. The catalog effect later confirms / re-anchors them once the
  // server-side enumeration arrives.
  const [chosenStoreID, setChosenStoreID] = React.useState<string>(
    props.provisionedStoreID ?? ''
  )
  const [chosenProductID, setChosenProductID] = React.useState<string>(
    props.provisionedProductID ?? ''
  )
  const [returnURL, setReturnURL] = React.useState(
    props.defaultValues.WaffoPancakeReturnURL ?? ''
  )
  const [creatingPair, setCreatingPair] = React.useState(false)

  const initialRef = React.useRef(props.defaultValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(props.defaultValues),
    [props.defaultValues]
  )

  // Tracks which "merchantID|privateKey" pair we last verified against
  // Pancake so the debounced effect skips when nothing changed.
  const lastVerifiedSignature = React.useRef('')
  const fetchSerialRef = React.useRef(0)

  const form = useForm({
    resolver: zodResolver(waffoPancakeSchema),
    mode: 'onChange',
    defaultValues: {
      WaffoPancakeMerchantID: props.defaultValues.WaffoPancakeMerchantID,
      WaffoPancakePrivateKey: props.defaultValues.WaffoPancakePrivateKey,
    },
  })

  // Mount-only initialisation. We never re-sync form values from props after
  // the first render — the PrivateKey is sensitive and never echoed by the
  // backend, so a subsequent reset would wipe whatever the operator typed.
  const didMountRef = React.useRef(false)
  React.useEffect(() => {
    const parsed = JSON.parse(defaultsSignature) as WaffoPancakeSettingsValues
    initialRef.current = parsed
    if (didMountRef.current) return
    didMountRef.current = true
    form.reset({
      WaffoPancakeMerchantID: parsed.WaffoPancakeMerchantID,
      WaffoPancakePrivateKey: parsed.WaffoPancakePrivateKey,
    })
    setReturnURL(parsed.WaffoPancakeReturnURL ?? '')
    lastVerifiedSignature.current = `${parsed.WaffoPancakeMerchantID.trim()}|${parsed.WaffoPancakePrivateKey.trim()}`
  }, [defaultsSignature, form])

  React.useEffect(() => {
    setStoreID(props.provisionedStoreID ?? '')
  }, [props.provisionedStoreID])

  React.useEffect(() => {
    setProductID(props.provisionedProductID ?? '')
  }, [props.provisionedProductID])

  const productsForChosenStore = React.useMemo(() => {
    if (!chosenStoreID) return []
    return catalog.find((s) => s.id === chosenStoreID)?.onetimeProducts ?? []
  }, [catalog, chosenStoreID])

  // Select items mirror the catalog. When the saved binding refers to an ID
  // we don't have a full record for yet (catalog still loading on initial
  // mount, or the entity has been deleted on Pancake's side), we append the
  // raw ID as an item so the SelectTrigger can render it instead of the
  // empty placeholder. The fallback item disappears as soon as the catalog
  // loads and contains the real labeled entry.
  const storeSelectItems = React.useMemo(() => {
    const items = catalog.map((s) => ({
      value: s.id,
      label: `${s.name} (${s.id})`,
    }))
    if (chosenStoreID && !catalog.some((s) => s.id === chosenStoreID)) {
      items.push({ value: chosenStoreID, label: chosenStoreID })
    }
    return items
  }, [catalog, chosenStoreID])
  const productSelectItems = React.useMemo(() => {
    const items = productsForChosenStore.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.id})`,
    }))
    if (
      chosenProductID &&
      !productsForChosenStore.some((p) => p.id === chosenProductID)
    ) {
      items.push({ value: chosenProductID, label: chosenProductID })
    }
    return items
  }, [productsForChosenStore, chosenProductID])

  // Fetches the merchant's catalog with credentials passed verbatim in the
  // request body — nothing about the typed values is written to the OptionMap.
  //
  // `preselect` lets callers (notably handleCreatePair after a successful
  // mint) tell us "after the catalog reloads, anchor the dropdowns to
  // these IDs". When omitted, we fall back to the existing precedence:
  // saved binding → first store with products → empty.
  const verifyAndFetchCatalog = React.useCallback(
    async (
      merchantID: string,
      privateKey: string,
      preselect?: { storeID?: string; productID?: string }
    ) => {
      const serial = ++fetchSerialRef.current
      let stores: CatalogStore[] = []
      try {
        const res = await api.post<BackendBody<{ stores: CatalogStore[] }>>(
          '/api/option/waffo-pancake/catalog',
          { merchant_id: merchantID, private_key: privateKey }
        )
        if (serial !== fetchSerialRef.current) return
        const body = res.data
        if (
          body?.message === 'success' &&
          typeof body.data === 'object' &&
          body.data
        ) {
          stores = (body.data as { stores: CatalogStore[] }).stores ?? []
        } else {
          const reason = typeof body?.data === 'string' ? body.data : undefined
          toast.error(
            reason
              ? `${t('Credentials verification failed')}: ${reason}`
              : t(
                  'Credentials verification failed — double-check Merchant ID and API private key.'
                )
          )
          setPhase('idle')
          return
        }
      } catch (err) {
        if (serial !== fetchSerialRef.current) return
        toast.error(
          `${t('Credentials verification failed')}: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
        setPhase('idle')
        return
      }
      if (serial !== fetchSerialRef.current) return

      setCatalog(stores)
      if (preselect) {
        // Explicit override — caller knows which IDs to anchor on (e.g.
        // freshly-minted IDs from a successful + Create round-trip).
        setChosenStoreID(preselect.storeID ?? '')
        setChosenProductID(preselect.productID ?? '')
      } else {
        // Pre-select the currently-bound product when re-loading, so the
        // dropdowns echo what's already saved. Otherwise default to the
        // first store with products + its first product — so a returning
        // operator with credentials but no saved binding can hit Save
        // without an extra click.
        const boundStore = stores.find((s) =>
          s.onetimeProducts.some((p) => p.id === productID)
        )
        if (boundStore && productID) {
          setChosenStoreID(boundStore.id)
          setChosenProductID(productID)
        } else {
          const storeWithProducts = stores.find(
            (s) => s.onetimeProducts.length > 0
          )
          if (storeWithProducts) {
            setChosenStoreID(storeWithProducts.id)
            setChosenProductID(storeWithProducts.onetimeProducts[0].id)
          } else {
            setChosenStoreID('')
            setChosenProductID('')
          }
        }
      }
      setPhase('idle')
    },
    [productID, t]
  )

  // Debounced auto-verify when both fields are non-empty.
  const watchedMerchantID = form.watch('WaffoPancakeMerchantID') || ''
  const watchedPrivateKey = form.watch('WaffoPancakePrivateKey') || ''
  React.useEffect(() => {
    const m = watchedMerchantID.trim()
    const k = watchedPrivateKey.trim()
    if (!m || !k) return
    const signature = `${m}|${k}`
    if (signature === lastVerifiedSignature.current) return
    const timer = setTimeout(() => {
      lastVerifiedSignature.current = signature
      setPhase('verifying')
      void verifyAndFetchCatalog(m, k)
    }, 800)
    return () => clearTimeout(timer)
  }, [watchedMerchantID, watchedPrivateKey, verifyAndFetchCatalog])

  // Initial-load auto-verify using SAVED credentials.
  //
  // The backend strips the private key from GET /api/option/ (it's a
  // *Key-suffixed option, so the sensitive-key filter removes it). That
  // means a returning admin opens the page with a populated MerchantID but
  // an empty PrivateKey field — the debounced effect above won't fire, so
  // the catalog stays empty and the operator can't see their bound store.
  //
  // To unblock this, we fire one catalog query on mount with empty creds in
  // the body. The catalog controller treats "both blank" as "use the saved
  // creds from the OptionMap" and runs the query server-side. The frontend
  // never sees the private key, but the dropdowns populate as expected.
  const initialLoadRef = React.useRef(false)
  React.useEffect(() => {
    if (initialLoadRef.current) return
    if (!props.defaultValues.WaffoPancakeMerchantID.trim()) return
    initialLoadRef.current = true
    setPhase('verifying')
    // Empty strings — backend falls back to setting-stored creds.
    void verifyAndFetchCatalog('', '')
  }, [props.defaultValues.WaffoPancakeMerchantID, verifyAndFetchCatalog])

  // Helper: pull current creds for an admin request body.
  //
  // Returns the typed values when the operator has edited either credential
  // field (MerchantID changed or any PrivateKey entered); otherwise returns
  // empty strings, which signal the backend to fall back to the persisted
  // creds via resolveWaffoPancakeAdminCreds. Without this branch, the
  // returning-admin case sends {merchantID: <saved>, privateKey: ''} which
  // the backend would treat as "typed creds with missing key" and reject.
  const readCreds = () => {
    const formMerchant = (
      form.getValues('WaffoPancakeMerchantID') || ''
    ).trim()
    const formKey = (form.getValues('WaffoPancakePrivateKey') || '').trim()
    const saved = (props.defaultValues.WaffoPancakeMerchantID || '').trim()
    const edited = formMerchant !== saved || formKey.length > 0
    if (!edited) return { merchantID: '', privateKey: '' }
    return { merchantID: formMerchant, privateKey: formKey }
  }

  // handleCreatePair mints a fresh store AND a fresh product in one shot.
  // The product's SuccessURL is bound to whatever sits in the Return URL
  // field — so we prompt for explicit acknowledgement when that field is
  // empty rather than silently creating a product without a redirect.
  const handleCreatePair = async () => {
    if (!credsReady) {
      toast.error(
        t('Fill in both Merchant ID and API Private Key before creating.')
      )
      return
    }
    const { merchantID, privateKey } = readCreds()
    const trimmedReturn = removeTrailingSlash(returnURL.trim())
    if (!trimmedReturn) {
      if (
        !window.confirm(
          t(
            'Payment return URL is empty. Create the product without a SuccessURL redirect?'
          )
        )
      ) {
        return
      }
    }
    setCreatingPair(true)
    try {
      // Single round-trip — backend creates Store + OnetimeProduct
      // server-side and returns both IDs. On the unhappy path where only
      // the store landed, the error data carries `orphan_store: true`
      // along with the store_id/name so we can still preselect that
      // store in the dropdown for retry.
      const res = await api.post<
        BackendBody<{
          store_id: string
          store_name: string
          product_id: string
          product_name: string
        }>
      >('/api/option/waffo-pancake/pair', {
        merchant_id: merchantID,
        private_key: privateKey,
        return_url: trimmedReturn,
      })
      const body = res.data
      if (
        body?.message === 'success' &&
        typeof body.data === 'object' &&
        body.data
      ) {
        const created = body.data as {
          store_id: string
          store_name: string
          product_id: string
          product_name: string
        }
        // Don't trust the response body — refetch the catalog from
        // Pancake's GraphQL so the dropdowns reflect authoritative state,
        // then anchor the selectors on the freshly-minted IDs.
        setPhase('verifying')
        await verifyAndFetchCatalog(merchantID, privateKey, {
          storeID: created.store_id,
          productID: created.product_id,
        })
        toast.success(
          `${t('Store + product created')}: ${created.store_id} / ${created.product_id}`
        )
        return
      }
      // Failure paths — distinguish orphan-store partial failure from a
      // generic error so the operator gets actionable feedback.
      const errData =
        body && typeof body.data === 'object' && body.data !== null
          ? (body.data as {
              error?: string
              orphan_store?: boolean
              store_id?: string
              store_name?: string
            })
          : null
      if (errData?.orphan_store && errData.store_id) {
        // Same authoritative refresh on the partial-failure path — the
        // orphan store really did land on Pancake's side, so a real query
        // will surface it (no need to optimistically inject).
        setPhase('verifying')
        await verifyAndFetchCatalog(merchantID, privateKey, {
          storeID: errData.store_id,
          productID: '',
        })
      }
      const reason =
        errData?.error ??
        (typeof body?.data === 'string' ? body.data : undefined)
      toast.error(
        reason ? `${t('Creation failed')}: ${reason}` : t('Creation failed')
      )
    } catch (err) {
      toast.error(
        `${t('Creation failed')}: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setCreatingPair(false)
    }
  }

  const handleSave = async () => {
    // Save sends form values raw — it does NOT route through the
    // smart-empty readCreds() because the backend's SaveWaffoPancakeConfig
    // already handles "blank private key means keep existing", and Save
    // requires a non-empty MerchantID. For a returning admin that hasn't
    // edited creds, the MerchantID is still populated from props
    // (defaultValues), so this works without any fallback.
    const merchantID = (
      form.getValues('WaffoPancakeMerchantID') || ''
    ).trim()
    const privateKey = (
      form.getValues('WaffoPancakePrivateKey') || ''
    ).trim()
    if (!merchantID) {
      toast.error(t('Merchant ID is required.'))
      return
    }
    if (!chosenStoreID || !chosenProductID) {
      toast.error(t('Pick or create both a store and a product before saving.'))
      return
    }
    setPhase('saving')
    try {
      const res = await api.post<
        BackendBody<{ product_id: string; store_id: string }>
      >('/api/option/waffo-pancake/save', {
        merchant_id: merchantID,
        private_key: privateKey,
        return_url: removeTrailingSlash(returnURL.trim()),
        store_id: chosenStoreID,
        product_id: chosenProductID,
      })
      const body = res.data
      if (
        body?.message === 'success' &&
        typeof body.data === 'object' &&
        body.data
      ) {
        const saved = body.data as { product_id: string; store_id: string }
        setStoreID(saved.store_id)
        setProductID(saved.product_id)
        toast.success(t('Waffo Pancake settings saved'))
      } else {
        const reason = typeof body?.data === 'string' ? body.data : undefined
        toast.error(
          reason
            ? `${t('Waffo Pancake save failed')}: ${reason}`
            : t('Waffo Pancake save failed')
        )
      }
    } catch (err) {
      toast.error(
        `${t('Waffo Pancake save failed')}: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    } finally {
      setPhase('idle')
    }
  }

  const verifying = phase === 'verifying'
  const saving = phase === 'saving'

  // Saved-vs-typed credential resolution.
  //
  // The PrivateKey field is sensitive — the backend strips it from
  // GET /api/option/, so on initial mount the form has
  //   { merchantID: <saved or ''>, privateKey: '' }
  // To support returning admins who shouldn't have to re-paste the private
  // key just to click "+ Create" or trigger a re-verify, we treat the form
  // as "not edited" when the MerchantID still matches what came from props
  // AND the PrivateKey field is empty. In that case the backend will fall
  // back to the persisted creds (see resolveWaffoPancakeAdminCreds in
  // controller/topup_waffo_pancake.go).
  //
  // Any deviation — a changed MerchantID OR any non-empty PrivateKey —
  // counts as an edit, and we require BOTH fields filled before letting
  // the operator proceed (mixed states would either fail signature
  // verification or silently use a stale key).
  const savedMerchantID = (
    props.defaultValues.WaffoPancakeMerchantID || ''
  ).trim()
  const formMerchantID = watchedMerchantID.trim()
  const formPrivateKey = watchedPrivateKey.trim()
  const credsEdited =
    formMerchantID !== savedMerchantID || formPrivateKey.length > 0
  const hasSavedCreds = savedMerchantID.length > 0
  const credsReady = credsEdited
    ? formMerchantID.length > 0 && formPrivateKey.length > 0
    : hasSavedCreds
  const hasCatalog = catalog.length > 0

  return (
    <SettingsSection
      title={t('Waffo Pancake MoR')}
      description={t(
        'Start collecting payments globally without registering a company. Built for indie developers, OPC sole proprietorships, and startups. Waffo Pancake acts as your Merchant of Record, taking on the compliance burden of global payment collection — consumption tax, invoicing, subscription management, refunds, and chargebacks. Solo developers can launch without registering a company and stay focused on product instead of compliance. Onboard in minutes — one prompt to a full integration.'
      )}
    >
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className='space-y-4'
          data-no-autosubmit='true'
        >
          {/* Blue box — webhook configuration only. */}
          <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
            <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
            <ul className='list-inside list-disc space-y-1'>
              <li>
                {t('Webhook URL (Test):')}{' '}
                <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                  {'<ServerAddress>/api/waffo-pancake/webhook/test'}
                </code>
              </li>
              <li>
                {t('Webhook URL (Production):')}{' '}
                <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                  {'<ServerAddress>/api/waffo-pancake/webhook/prod'}
                </code>
              </li>
              <li>
                {t(
                  'Register each URL into the matching Test Mode / Production Mode webhook slot in the Pancake dashboard. Separate endpoints prevent test traffic from accidentally crediting production accounts.'
                )}
              </li>
              <li>
                {t('Configure at:')}{' '}
                <a
                  href={PANCAKE_DASHBOARD_URL}
                  target='_blank'
                  rel='noreferrer'
                  className='underline hover:no-underline'
                >
                  {t('Waffo Pancake Dashboard')}
                </a>
              </li>
            </ul>
          </div>

          <FormField
            control={form.control}
            name='WaffoPancakeMerchantID'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Merchant ID')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='MER_xxx'
                    autoComplete='off'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='WaffoPancakePrivateKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('API Private Key')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={t('Leave blank to keep the existing key')}
                    autoComplete='new-password'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                    className='font-mono text-xs'
                  />
                </FormControl>
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'The environment (test vs production) is decided by the key you paste here — use the Test key while integrating, then swap to the Production key when going live.'
                  )}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/*
          Binding section — split into two visually distinct paths:
          (A) "Use existing" pair from the loaded catalog — only rendered when
              the merchant actually has stores, so first-time setup isn't
              cluttered by dead dropdowns.
          (B) "Create a fresh pair" — always available, paired with the
              return URL field that's only meaningful here.
          The two paths are split by an "or" divider so the operator never has
          to wonder which field belongs to which intent.
        */}
          <div className='space-y-4 pt-2'>
            <div>
              <h4 className='font-medium'>
                {t('Bind a Pancake store + product')}
              </h4>
              <p className='text-muted-foreground text-xs'>
                {!credsReady
                  ? t('Fill in the credentials above to begin.')
                  : verifying
                    ? t(
                        'Verifying credentials and pulling stores from your Pancake account...'
                      )
                    : hasCatalog
                      ? t(
                          'Mint a fresh pair below — or pick an existing one further down. Click Save when ready.'
                        )
                      : t(
                          'No stores on this merchant yet. Set a return URL and click Create to mint your first pair.'
                        )}
              </p>
            </div>

            {/* Create section — first, since creating auto-fills the pick-existing dropdowns below. */}
            <div className='space-y-1.5'>
              <Label>{t('Payment return URL')}</Label>
              <div className='flex gap-2'>
                <Input
                  placeholder='https://example.com/console/topup'
                  value={returnURL}
                  onChange={(event) => setReturnURL(event.target.value)}
                  className='flex-1'
                />
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleCreatePair}
                  disabled={creatingPair || verifying || !credsReady}
                  className='shrink-0'
                >
                  {creatingPair
                    ? t('Creating...')
                    : `+ ${t('Create')} ${DEFAULT_NEW_PAIR_NAME}`}
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(
                  "Used as SuccessURL on the new product. You'll be prompted to confirm if left blank."
                )}
              </p>
            </div>

            {hasCatalog ? (
              <>
                <div className='relative flex items-center py-1'>
                  <div className='flex-1 border-t' />
                  <span className='text-muted-foreground px-3 text-[10px] font-medium tracking-[0.2em] uppercase'>
                    {t('or pick existing')}
                  </span>
                  <div className='flex-1 border-t' />
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <div className='grid gap-1.5'>
                    <Label>{t('Store')}</Label>
                    <Select
                      items={storeSelectItems}
                      value={chosenStoreID}
                      onValueChange={(value) => {
                        setChosenStoreID(value)
                        setChosenProductID('')
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('Select a store')} />
                      </SelectTrigger>
                      <SelectContent>
                        {storeSelectItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='grid gap-1.5'>
                    <Label>{t('Product')}</Label>
                    <Select
                      items={productSelectItems}
                      value={chosenProductID}
                      onValueChange={setChosenProductID}
                      disabled={
                        !chosenStoreID || productSelectItems.length === 0
                      }
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('Select a product')} />
                      </SelectTrigger>
                      <SelectContent>
                        {productSelectItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : null}

            <div className='flex items-center gap-3'>
              <Button
                type='button'
                onClick={handleSave}
                disabled={saving || !chosenStoreID || !chosenProductID}
              >
                {saving ? t('Saving...') : t('Save Waffo Pancake settings')}
              </Button>
              {storeID || productID ? (
                <div className='text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs'>
                  {storeID ? (
                    <span>
                      {t('Bound store:')}{' '}
                      <code className='bg-muted rounded px-1 py-0.5'>
                        {storeID}
                      </code>
                    </span>
                  ) : null}
                  {productID ? (
                    <span>
                      {t('Bound product:')}{' '}
                      <code className='bg-muted rounded px-1 py-0.5'>
                        {productID}
                      </code>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </form>
      </Form>
    </SettingsSection>
  )
}
