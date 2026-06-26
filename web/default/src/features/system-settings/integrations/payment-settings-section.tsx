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
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CircleHelp, Code2, Eye, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RiskAcknowledgementDialog } from '@/components/risk-acknowledgement-dialog'
import { confirmPaymentCompliance } from '../api'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'
import {
  getAmountBonusGroupsJsonError,
  getAmountBonusJsonError,
  getAmountBonusLimitJsonError,
} from './amount-bonus-utils'
import { AmountBonusVisualEditor } from './amount-bonus-visual-editor'
import { AmountDiscountVisualEditor } from './amount-discount-visual-editor'
import { AmountOptionsVisualEditor } from './amount-options-visual-editor'
import { CreemProductsVisualEditor } from './creem-products-visual-editor'
import { PaymentMethodsVisualEditor } from './payment-methods-visual-editor'
import {
  buildStripeTopUpPriceRows,
  serializeStripeTopUpPriceIds,
} from './stripe-price-id-config'
import {
  formatJsonForEditor,
  getJsonError,
  normalizeJsonForComparison,
  removeTrailingSlash,
} from './utils'
import { saveWaffoPancakeConfig } from './waffo-pancake-api'
import {
  WaffoPancakeSettingsSection,
  type WaffoPancakeBinding,
  type WaffoPancakeSettingsValues,
} from './waffo-pancake-settings-section'
import {
  type PayMethod,
  WaffoSettingsSection,
  type WaffoSettingsValues,
} from './waffo-settings-section'

const PADDLE_SANDBOX_API_KEY_PREFIX = 'pdl_sdbx_apikey_'
const PADDLE_LIVE_API_KEY_PREFIX = 'pdl_live_apikey_'
const PADDLE_INCOMPLETE_API_KEY_PREFIX = 'apikey_'
const PADDLE_SANDBOX_CLIENT_TOKEN_PREFIX = 'test_'
const PADDLE_LIVE_CLIENT_TOKEN_PREFIX = 'live_'
const PADDLE_WEBHOOK_SECRET_PREFIX = 'pdl_ntfset_'
const PADDLE_NOTIFICATION_ID_PREFIX = 'ntfset_'
const PADDLE_PRODUCT_ID_PREFIX = 'pro_'
const PADDLE_SANDBOX_API_KEY_PATTERN =
  /^pdl_sdbx_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/
const PADDLE_LIVE_API_KEY_PATTERN =
  /^pdl_live_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/
const PADDLE_SANDBOX_CLIENT_TOKEN_PATTERN = /^test_[a-zA-Z\d]{27}$/
const PADDLE_LIVE_CLIENT_TOKEN_PATTERN = /^live_[a-zA-Z\d]{27}$/
const PADDLE_WEBHOOK_SECRET_PATTERN =
  /^pdl_ntfset_[a-zA-Z\d]{26}_[a-zA-Z\d]{32}$/
const PADDLE_PRODUCT_ID_PATTERN = /^pro_[a-z\d]{26}$/
const PADDLE_CURRENCY_PATTERN = /^[A-Z]{3}$/
const PADDLE_SANDBOX_API_KEY_ERROR = `Paddle sandbox API key must be the full 69-character key matching ${PADDLE_SANDBOX_API_KEY_PREFIX}..._..._...`
const PADDLE_LIVE_API_KEY_ERROR = `Paddle live API key must be the full 69-character key matching ${PADDLE_LIVE_API_KEY_PREFIX}..._..._...; ${PADDLE_INCOMPLETE_API_KEY_PREFIX} or ${PADDLE_LIVE_API_KEY_PREFIX} without the secret suffix is incomplete.`
const PADDLE_SANDBOX_CLIENT_TOKEN_ERROR = `Paddle sandbox client-side token must match ${PADDLE_SANDBOX_CLIENT_TOKEN_PREFIX} plus 27 letters or digits.`
const PADDLE_LIVE_CLIENT_TOKEN_ERROR = `Paddle live client-side token must match ${PADDLE_LIVE_CLIENT_TOKEN_PREFIX} plus 27 letters or digits.`
const PADDLE_WEBHOOK_SECRET_ERROR = `Paddle endpoint signing secret must match ${PADDLE_WEBHOOK_SECRET_PREFIX}..._...; ${PADDLE_NOTIFICATION_ID_PREFIX} is only the notification destination ID.`
const PADDLE_PRODUCT_ID_ERROR = `Paddle product ID must match ${PADDLE_PRODUCT_ID_PREFIX} plus 26 lowercase letters or digits.`
const PADDLE_CURRENCY_ERROR =
  'Paddle currency must be a three-letter ISO 4217 currency code.'
const PADDLE_PRODUCT_ID_REQUIRED_ERROR =
  'Paddle product ID is required when Paddle payment method is enabled.'
const PADDLE_CURRENCY_REQUIRED_ERROR =
  'Paddle currency is required when Paddle payment method is enabled.'
const PADDLE_UNIT_PRICE_REQUIRED_ERROR =
  'Paddle unit price must be greater than 0 when Paddle payment method is enabled.'

type PaddleEnvironmentFields = {
  PaddleSandbox: boolean
  PaddleApiKey: string
  PaddleClientToken: string
}

function getEffectivePaddleSandboxValue(
  values: PaddleEnvironmentFields
): boolean {
  const apiKey = values.PaddleApiKey.trim()
  if (apiKey.startsWith(PADDLE_LIVE_API_KEY_PREFIX)) {
    return false
  }
  if (apiKey.startsWith(PADDLE_SANDBOX_API_KEY_PREFIX)) {
    return true
  }

  const clientToken = values.PaddleClientToken.trim()
  if (clientToken.startsWith(PADDLE_LIVE_CLIENT_TOKEN_PREFIX)) {
    return false
  }
  if (clientToken.startsWith(PADDLE_SANDBOX_CLIENT_TOKEN_PREFIX)) {
    return true
  }

  return values.PaddleSandbox
}

type FormLabelWithHelpProps = {
  label: React.ReactNode
  help: React.ReactNode
  helpLabel: string
  error?: React.ReactNode
  errorLabel?: string
}

function FormLabelWithHelp(props: FormLabelWithHelpProps) {
  return (
    <div className='flex items-center gap-1.5'>
      <FormLabel>{props.label}</FormLabel>
      <TooltipProvider delay={100}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type='button'
                aria-label={props.helpLabel}
                className='text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none'
              />
            }
          >
            <CircleHelp className='size-3.5' aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent
            side='top'
            align='start'
            className='max-w-80 items-start text-left leading-relaxed whitespace-normal'
          >
            {props.help}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {props.error ? (
        <TooltipProvider delay={100}>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type='button'
                  aria-label={props.errorLabel}
                  className='text-destructive focus-visible:ring-ring/50 inline-flex rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none'
                />
              }
            >
              <AlertCircle className='size-3.5' aria-hidden='true' />
            </TooltipTrigger>
            <TooltipContent
              side='top'
              align='start'
              className='max-w-80 items-start text-left leading-relaxed whitespace-normal'
            >
              {props.error}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  )
}

function addOptionalPatternIssue(
  ctx: z.RefinementCtx,
  path: string,
  value: string,
  pattern: RegExp,
  message: string
): void {
  const normalized = value.trim()
  if (!normalized || pattern.test(normalized)) {
    return
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message,
  })
}

function addRequiredStringIssue(
  ctx: z.RefinementCtx,
  path: string,
  value: string,
  message: string
): void {
  if (value.trim()) {
    return
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message,
  })
}

function paymentMethodsIncludeType(value: string, type: string): boolean {
  try {
    const parsed = JSON.parse(value)
    return (
      Array.isArray(parsed) &&
      parsed.some((method) => {
        if (!method || typeof method !== 'object') {
          return false
        }
        const candidate = (method as { type?: unknown }).type
        return typeof candidate === 'string' && candidate.trim() === type
      })
    )
  } catch (_error) {
    return false
  }
}

const paymentSchema = z
  .object({
    PayAddress: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^https?:\/\//.test(trimmed)
    }, 'Provide a valid callback URL starting with http:// or https://'),
    EpayId: z.string(),
    EpayKey: z.string(),
    Price: z.coerce.number().min(0),
    MinTopUp: z.coerce.number().min(0),
    CustomCallbackAddress: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^https?:\/\//.test(trimmed)
    }, 'Provide a valid URL starting with http:// or https://'),
    PayMethods: z.string().superRefine((value, ctx) => {
      const error = getJsonError(value)
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    AmountOptions: z.string().superRefine((value, ctx) => {
      const error = getJsonError(value, (parsed) => Array.isArray(parsed))
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    AmountDiscount: z.string().superRefine((value, ctx) => {
      const error = getJsonError(
        value,
        (parsed) =>
          !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      )
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    AmountBonus: z.string().superRefine((value, ctx) => {
      const error = getAmountBonusJsonError(value)
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    AmountBonusLimit: z.string().superRefine((value, ctx) => {
      const error = getAmountBonusLimitJsonError(value)
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    AmountBonusGroups: z.string().superRefine((value, ctx) => {
      const error = getAmountBonusGroupsJsonError(value)
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    StripeApiSecret: z.string(),
    StripeWebhookSecret: z.string(),
    StripePriceId: z.string(),
    StripePriceId20: z.string(),
    StripePriceId200: z.string(),
    StripeTopUpPriceIds: z.string().superRefine((value, ctx) => {
      const error = getJsonError(
        value,
        (parsed) =>
          !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      )
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    StripeUnitPrice: z.coerce.number().min(0),
    StripeMinTopUp: z.coerce.number().min(0),
    StripePromotionCodesEnabled: z.boolean(),
    CreemApiKey: z.string(),
    CreemWebhookSecret: z.string(),
    CreemTestMode: z.boolean(),
    CreemProducts: z.string().superRefine((value, ctx) => {
      const error = getJsonError(value, (parsed) => Array.isArray(parsed))
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        })
      }
    }),
    PaddleApiKey: z.string(),
    PaddleClientToken: z.string(),
    PaddleWebhookSecret: z.string(),
    PaddleSandbox: z.boolean(),
    PaddleProductId: z.string(),
    PaddleCurrency: z.string(),
    PaddleUnitPrice: z.coerce.number().min(0),
    PaddleMinTopUp: z.coerce.number().min(1),
    WaffoEnabled: z.boolean(),
    WaffoApiKey: z.string(),
    WaffoPrivateKey: z.string(),
    WaffoPublicCert: z.string(),
    WaffoSandboxPublicCert: z.string(),
    WaffoSandboxApiKey: z.string(),
    WaffoSandboxPrivateKey: z.string(),
    WaffoSandbox: z.boolean(),
    WaffoMerchantId: z.string(),
    WaffoCurrency: z.string(),
    WaffoUnitPrice: z.coerce.number().min(0),
    WaffoMinTopUp: z.coerce.number().min(1),
    WaffoNotifyUrl: z.string(),
    WaffoReturnUrl: z.string(),
    WaffoPancakeMerchantID: z.string(),
    WaffoPancakePrivateKey: z.string(),
    WaffoPancakeReturnURL: z.string(),
  })
  .superRefine((values, ctx) => {
    const effectivePaddleSandbox = getEffectivePaddleSandboxValue(values)
    addOptionalPatternIssue(
      ctx,
      'PaddleApiKey',
      values.PaddleApiKey,
      effectivePaddleSandbox
        ? PADDLE_SANDBOX_API_KEY_PATTERN
        : PADDLE_LIVE_API_KEY_PATTERN,
      effectivePaddleSandbox
        ? PADDLE_SANDBOX_API_KEY_ERROR
        : PADDLE_LIVE_API_KEY_ERROR
    )
    addOptionalPatternIssue(
      ctx,
      'PaddleClientToken',
      values.PaddleClientToken,
      effectivePaddleSandbox
        ? PADDLE_SANDBOX_CLIENT_TOKEN_PATTERN
        : PADDLE_LIVE_CLIENT_TOKEN_PATTERN,
      effectivePaddleSandbox
        ? PADDLE_SANDBOX_CLIENT_TOKEN_ERROR
        : PADDLE_LIVE_CLIENT_TOKEN_ERROR
    )
    addOptionalPatternIssue(
      ctx,
      'PaddleWebhookSecret',
      values.PaddleWebhookSecret,
      PADDLE_WEBHOOK_SECRET_PATTERN,
      PADDLE_WEBHOOK_SECRET_ERROR
    )
    addOptionalPatternIssue(
      ctx,
      'PaddleProductId',
      values.PaddleProductId,
      PADDLE_PRODUCT_ID_PATTERN,
      PADDLE_PRODUCT_ID_ERROR
    )
    addOptionalPatternIssue(
      ctx,
      'PaddleCurrency',
      values.PaddleCurrency.toUpperCase(),
      PADDLE_CURRENCY_PATTERN,
      PADDLE_CURRENCY_ERROR
    )
    if (paymentMethodsIncludeType(values.PayMethods, 'paddle')) {
      addRequiredStringIssue(
        ctx,
        'PaddleProductId',
        values.PaddleProductId,
        PADDLE_PRODUCT_ID_REQUIRED_ERROR
      )
      addRequiredStringIssue(
        ctx,
        'PaddleCurrency',
        values.PaddleCurrency,
        PADDLE_CURRENCY_REQUIRED_ERROR
      )
      if (values.PaddleUnitPrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PaddleUnitPrice'],
          message: PADDLE_UNIT_PRICE_REQUIRED_ERROR,
        })
      }
    }
  })

type PaymentFormValues = z.infer<typeof paymentSchema>
type WaffoFormFieldValues = Omit<WaffoSettingsValues, 'WaffoPayMethods'>
type PaymentBaseFormValues = Omit<
  PaymentFormValues,
  keyof WaffoFormFieldValues | keyof WaffoPancakeSettingsValues
>

const CURRENT_COMPLIANCE_TERMS_VERSION = 'v1'

type PaymentComplianceDefaults = {
  confirmed: boolean
  termsVersion: string
  confirmedAt: number
  confirmedBy: number
}

type PaymentSettingsSectionProps = {
  defaultValues: PaymentBaseFormValues
  waffoDefaultValues: WaffoSettingsValues
  waffoPancakeDefaultValues: WaffoPancakeSettingsValues
  waffoPancakeProvisionedStoreID?: string
  waffoPancakeProvisionedProductID?: string
  complianceDefaults: PaymentComplianceDefaults
}

function parseWaffoPayMethods(value: string): PayMethod[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function PaymentSettingsSection({
  defaultValues,
  waffoDefaultValues,
  waffoPancakeDefaultValues,
  waffoPancakeProvisionedStoreID,
  waffoPancakeProvisionedProductID,
  complianceDefaults,
}: PaymentSettingsSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const updateOption = useUpdateOption()
  const initialFormValues = React.useMemo<PaymentFormValues>(
    () => ({
      ...defaultValues,
      ...waffoDefaultValues,
      ...waffoPancakeDefaultValues,
    }),
    [defaultValues, waffoDefaultValues, waffoPancakeDefaultValues]
  )
  const initialRef = React.useRef(initialFormValues)
  const defaultsSignature = React.useMemo(
    () => JSON.stringify(initialFormValues),
    [initialFormValues]
  )

  const [payMethodsVisualMode, setPayMethodsVisualMode] = React.useState(true)
  const [amountOptionsVisualMode, setAmountOptionsVisualMode] =
    React.useState(true)
  const [amountBonusVisualMode, setAmountBonusVisualMode] = React.useState(true)
  const [amountDiscountVisualMode, setAmountDiscountVisualMode] =
    React.useState(true)
  const [creemProductsVisualMode, setCreemProductsVisualMode] =
    React.useState(true)
  const [showComplianceDialog, setShowComplianceDialog] = React.useState(false)
  const [waffoPayMethods, setWaffoPayMethods] = React.useState<PayMethod[]>(
    () => parseWaffoPayMethods(waffoDefaultValues.WaffoPayMethods)
  )
  const [waffoPancakeSelection, setWaffoPancakeSelection] =
    React.useState<WaffoPancakeBinding>({
      storeID: waffoPancakeProvisionedStoreID ?? '',
      productID: waffoPancakeProvisionedProductID ?? '',
    })
  const [waffoPancakeSavedBinding, setWaffoPancakeSavedBinding] =
    React.useState<WaffoPancakeBinding>({
      storeID: waffoPancakeProvisionedStoreID ?? '',
      productID: waffoPancakeProvisionedProductID ?? '',
    })

  React.useEffect(() => {
    setWaffoPayMethods(parseWaffoPayMethods(waffoDefaultValues.WaffoPayMethods))
  }, [waffoDefaultValues.WaffoPayMethods])

  React.useEffect(() => {
    const nextBinding = {
      storeID: waffoPancakeProvisionedStoreID ?? '',
      productID: waffoPancakeProvisionedProductID ?? '',
    }
    setWaffoPancakeSelection(nextBinding)
    setWaffoPancakeSavedBinding(nextBinding)
  }, [waffoPancakeProvisionedProductID, waffoPancakeProvisionedStoreID])

  const complianceStatements = React.useMemo(
    () => [
      t(
        'You have legally obtained authorization for the connected model APIs, accounts, keys, and quotas.'
      ),
      t(
        'You commit to using upstream APIs, accounts, keys, quotas, and service capabilities only within the scope of lawful authorization obtained from upstream service providers, model service providers, or relevant rights holders, and will not conduct unauthorized resale, trafficking, distribution, or other non-compliant commercialization.'
      ),
      t(
        'If you provide generative AI services to the public in mainland China, you will fulfill legal obligations including filing, security assessment, content safety, complaint handling, generated content labeling, log retention, and personal information protection.'
      ),
      t(
        'You commit not to use this system to implement, assist with, or indirectly implement acts that violate applicable laws and regulations, regulatory requirements, platform rules, public interests, or the lawful rights and interests of third parties.'
      ),
      t(
        'You understand and independently bear legal responsibility arising from deployment, operation, and charging behavior.'
      ),
      t(
        'You understand this compliance reminder is only for risk notice and does not constitute legal advice, a compliance review conclusion, or a guarantee of the legality of your use of this system; you should consult professional legal or compliance advisors based on your actual business scenario.'
      ),
    ],
    [t]
  )

  const complianceRequiredText = t(
    'I have read and understood the above compliance reminder, acknowledge the related legal risks, and confirm that I bear legal responsibility arising from deployment, operation, and charging behavior.'
  )
  const complianceRequiredTextParts = React.useMemo(
    () => [
      {
        type: 'input' as const,
        text: t('I have read and understood the above compliance reminder'),
      },
      { type: 'static' as const, text: t('，') },
      {
        type: 'input' as const,
        text: t('acknowledge the related legal risks'),
      },
      { type: 'static' as const, text: t('，and ') },
      {
        type: 'input' as const,
        text: t(
          'confirm that I bear legal responsibility arising from deployment'
        ),
      },
      { type: 'static' as const, text: t('、') },
      {
        type: 'input' as const,
        text: t('operation and charging behavior'),
      },
    ],
    [t]
  )

  const complianceConfirmed =
    complianceDefaults.confirmed &&
    complianceDefaults.termsVersion === CURRENT_COMPLIANCE_TERMS_VERSION

  const confirmComplianceMutation = useMutation({
    mutationFn: confirmPaymentCompliance,
    onSuccess: (data) => {
      if (data.success) {
        toast.success(t('Compliance confirmed successfully'))
        setShowComplianceDialog(false)
        queryClient.invalidateQueries({ queryKey: ['system-options'] })
      } else {
        toast.error(data.message || t('Failed to confirm compliance'))
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to confirm compliance'))
    },
  })

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as Resolver<PaymentFormValues>,
    mode: 'onChange', // Enable real-time validation
    defaultValues: {
      ...initialFormValues,
      PayMethods: formatJsonForEditor(initialFormValues.PayMethods),
      AmountOptions: formatJsonForEditor(initialFormValues.AmountOptions),
      AmountBonus: formatJsonForEditor(initialFormValues.AmountBonus),
      AmountBonusLimit: formatJsonForEditor(initialFormValues.AmountBonusLimit),
      AmountBonusGroups: formatJsonForEditor(
        initialFormValues.AmountBonusGroups
      ),
      AmountDiscount: formatJsonForEditor(initialFormValues.AmountDiscount),
      StripeTopUpPriceIds: formatJsonForEditor(
        initialFormValues.StripeTopUpPriceIds
      ),
      CreemProducts: formatJsonForEditor(initialFormValues.CreemProducts),
    },
  })

  const { isSubmitting } = form.formState
  const setPaymentValue = React.useCallback(
    (
      key: keyof PaymentFormValues,
      value: PaymentFormValues[keyof PaymentFormValues]
    ) => {
      form.setValue(
        key as Parameters<typeof form.setValue>[0],
        value as Parameters<typeof form.setValue>[1],
        {
          shouldDirty: true,
          shouldValidate: true,
        }
      )
    },
    [form]
  )

  const setWaffoValue = React.useCallback(
    <K extends keyof WaffoFormFieldValues>(
      key: K,
      value: WaffoFormFieldValues[K]
    ) => {
      setPaymentValue(
        key as keyof PaymentFormValues,
        value as PaymentFormValues[keyof PaymentFormValues]
      )
    },
    [setPaymentValue]
  )

  const setWaffoPancakeValue = React.useCallback(
    <K extends keyof WaffoPancakeSettingsValues>(
      key: K,
      value: WaffoPancakeSettingsValues[K]
    ) => {
      setPaymentValue(
        key as keyof PaymentFormValues,
        value as PaymentFormValues[keyof PaymentFormValues]
      )
    },
    [setPaymentValue]
  )

  React.useEffect(() => {
    const parsedDefaults = JSON.parse(defaultsSignature) as PaymentFormValues
    initialRef.current = parsedDefaults
    const effectivePaddleSandbox =
      getEffectivePaddleSandboxValue(parsedDefaults)
    form.reset({
      ...parsedDefaults,
      PaddleSandbox: effectivePaddleSandbox,
      PayMethods: formatJsonForEditor(parsedDefaults.PayMethods),
      AmountOptions: formatJsonForEditor(parsedDefaults.AmountOptions),
      AmountBonus: formatJsonForEditor(parsedDefaults.AmountBonus),
      AmountBonusLimit: formatJsonForEditor(parsedDefaults.AmountBonusLimit),
      AmountBonusGroups: formatJsonForEditor(parsedDefaults.AmountBonusGroups),
      AmountDiscount: formatJsonForEditor(parsedDefaults.AmountDiscount),
      StripeTopUpPriceIds: formatJsonForEditor(
        parsedDefaults.StripeTopUpPriceIds
      ),
      CreemProducts: formatJsonForEditor(parsedDefaults.CreemProducts),
    })
  }, [defaultsSignature, form])

  const onSubmit = async (values: PaymentFormValues) => {
    const sanitized = {
      PayAddress: removeTrailingSlash(values.PayAddress),
      EpayId: values.EpayId.trim(),
      EpayKey: values.EpayKey.trim(),
      Price: values.Price,
      MinTopUp: values.MinTopUp,
      CustomCallbackAddress: removeTrailingSlash(values.CustomCallbackAddress),
      PayMethods: values.PayMethods.trim(),
      AmountOptions: values.AmountOptions.trim(),
      AmountBonus: values.AmountBonus.trim(),
      AmountBonusLimit: values.AmountBonusLimit.trim(),
      AmountBonusGroups: values.AmountBonusGroups.trim(),
      AmountDiscount: values.AmountDiscount.trim(),
      StripeApiSecret: values.StripeApiSecret.trim(),
      StripeWebhookSecret: values.StripeWebhookSecret.trim(),
      StripePriceId: values.StripePriceId.trim(),
      StripePriceId20: values.StripePriceId20.trim(),
      StripePriceId200: values.StripePriceId200.trim(),
      StripeTopUpPriceIds: serializeStripeTopUpPriceIds(
        buildStripeTopUpPriceRows(
          values.AmountOptions,
          values.StripeTopUpPriceIds,
          {
            10: values.StripePriceId,
            20: values.StripePriceId20,
            200: values.StripePriceId200,
          }
        )
      ),
      StripeUnitPrice: values.StripeUnitPrice,
      StripeMinTopUp: values.StripeMinTopUp,
      StripePromotionCodesEnabled: values.StripePromotionCodesEnabled,
      CreemApiKey: values.CreemApiKey.trim(),
      CreemWebhookSecret: values.CreemWebhookSecret.trim(),
      CreemTestMode: values.CreemTestMode,
      CreemProducts: values.CreemProducts.trim(),
      PaddleApiKey: values.PaddleApiKey.trim(),
      PaddleClientToken: values.PaddleClientToken.trim(),
      PaddleWebhookSecret: values.PaddleWebhookSecret.trim(),
      PaddleSandbox: getEffectivePaddleSandboxValue(values),
      PaddleProductId: values.PaddleProductId.trim(),
      PaddleCurrency: values.PaddleCurrency.trim().toUpperCase() || 'USD',
      PaddleUnitPrice: values.PaddleUnitPrice,
      PaddleMinTopUp: values.PaddleMinTopUp,
      WaffoEnabled: values.WaffoEnabled,
      WaffoSandbox: values.WaffoSandbox,
      WaffoMerchantId: values.WaffoMerchantId.trim(),
      WaffoCurrency: values.WaffoCurrency.trim() || 'USD',
      WaffoUnitPrice: values.WaffoUnitPrice,
      WaffoMinTopUp: values.WaffoMinTopUp,
      WaffoNotifyUrl: values.WaffoNotifyUrl.trim(),
      WaffoReturnUrl: values.WaffoReturnUrl.trim(),
      WaffoPublicCert: values.WaffoPublicCert.trim(),
      WaffoSandboxPublicCert: values.WaffoSandboxPublicCert.trim(),
      WaffoApiKey: values.WaffoApiKey.trim(),
      WaffoPrivateKey: values.WaffoPrivateKey.trim(),
      WaffoSandboxApiKey: values.WaffoSandboxApiKey.trim(),
      WaffoSandboxPrivateKey: values.WaffoSandboxPrivateKey.trim(),
      WaffoPayMethods: JSON.stringify(waffoPayMethods),
      WaffoPancakeMerchantID: values.WaffoPancakeMerchantID.trim(),
      WaffoPancakePrivateKey: values.WaffoPancakePrivateKey.trim(),
      WaffoPancakeReturnURL: removeTrailingSlash(
        values.WaffoPancakeReturnURL.trim()
      ),
    }

    const initial = {
      PayAddress: removeTrailingSlash(initialRef.current.PayAddress),
      EpayId: initialRef.current.EpayId.trim(),
      EpayKey: initialRef.current.EpayKey.trim(),
      Price: initialRef.current.Price,
      MinTopUp: initialRef.current.MinTopUp,
      CustomCallbackAddress: removeTrailingSlash(
        initialRef.current.CustomCallbackAddress
      ),
      PayMethods: initialRef.current.PayMethods.trim(),
      AmountOptions: initialRef.current.AmountOptions.trim(),
      AmountBonus: initialRef.current.AmountBonus.trim(),
      AmountBonusLimit: initialRef.current.AmountBonusLimit.trim(),
      AmountBonusGroups: initialRef.current.AmountBonusGroups.trim(),
      AmountDiscount: initialRef.current.AmountDiscount.trim(),
      StripeApiSecret: initialRef.current.StripeApiSecret.trim(),
      StripeWebhookSecret: initialRef.current.StripeWebhookSecret.trim(),
      StripePriceId: initialRef.current.StripePriceId.trim(),
      StripePriceId20: initialRef.current.StripePriceId20.trim(),
      StripePriceId200: initialRef.current.StripePriceId200.trim(),
      StripeTopUpPriceIds: serializeStripeTopUpPriceIds(
        buildStripeTopUpPriceRows(
          initialRef.current.AmountOptions,
          initialRef.current.StripeTopUpPriceIds,
          {
            10: initialRef.current.StripePriceId,
            20: initialRef.current.StripePriceId20,
            200: initialRef.current.StripePriceId200,
          }
        )
      ),
      StripeUnitPrice: initialRef.current.StripeUnitPrice,
      StripeMinTopUp: initialRef.current.StripeMinTopUp,
      StripePromotionCodesEnabled:
        initialRef.current.StripePromotionCodesEnabled,
      CreemApiKey: initialRef.current.CreemApiKey.trim(),
      CreemWebhookSecret: initialRef.current.CreemWebhookSecret.trim(),
      CreemTestMode: initialRef.current.CreemTestMode,
      CreemProducts: initialRef.current.CreemProducts.trim(),
      PaddleApiKey: initialRef.current.PaddleApiKey.trim(),
      PaddleClientToken: initialRef.current.PaddleClientToken.trim(),
      PaddleWebhookSecret: initialRef.current.PaddleWebhookSecret.trim(),
      PaddleSandbox: initialRef.current.PaddleSandbox,
      PaddleProductId: initialRef.current.PaddleProductId.trim(),
      PaddleCurrency: initialRef.current.PaddleCurrency.trim() || 'USD',
      PaddleUnitPrice: initialRef.current.PaddleUnitPrice,
      PaddleMinTopUp: initialRef.current.PaddleMinTopUp,
      WaffoEnabled: initialRef.current.WaffoEnabled,
      WaffoSandbox: initialRef.current.WaffoSandbox,
      WaffoMerchantId: initialRef.current.WaffoMerchantId.trim(),
      WaffoCurrency: initialRef.current.WaffoCurrency.trim() || 'USD',
      WaffoUnitPrice: initialRef.current.WaffoUnitPrice,
      WaffoMinTopUp: initialRef.current.WaffoMinTopUp,
      WaffoNotifyUrl: initialRef.current.WaffoNotifyUrl.trim(),
      WaffoReturnUrl: initialRef.current.WaffoReturnUrl.trim(),
      WaffoPublicCert: initialRef.current.WaffoPublicCert.trim(),
      WaffoSandboxPublicCert: initialRef.current.WaffoSandboxPublicCert.trim(),
      WaffoApiKey: initialRef.current.WaffoApiKey.trim(),
      WaffoPrivateKey: initialRef.current.WaffoPrivateKey.trim(),
      WaffoSandboxApiKey: initialRef.current.WaffoSandboxApiKey.trim(),
      WaffoSandboxPrivateKey: initialRef.current.WaffoSandboxPrivateKey.trim(),
      WaffoPayMethods: JSON.stringify(
        parseWaffoPayMethods(waffoDefaultValues.WaffoPayMethods)
      ),
      WaffoPancakeMerchantID: initialRef.current.WaffoPancakeMerchantID.trim(),
      WaffoPancakePrivateKey: initialRef.current.WaffoPancakePrivateKey.trim(),
      WaffoPancakeReturnURL: removeTrailingSlash(
        initialRef.current.WaffoPancakeReturnURL.trim()
      ),
    }

    const updates: Array<{ key: string; value: string | number | boolean }> = []

    if (sanitized.PayAddress !== initial.PayAddress) {
      updates.push({ key: 'PayAddress', value: sanitized.PayAddress })
    }

    if (sanitized.EpayId !== initial.EpayId) {
      updates.push({ key: 'EpayId', value: sanitized.EpayId })
    }

    if (sanitized.EpayKey && sanitized.EpayKey !== initial.EpayKey) {
      updates.push({ key: 'EpayKey', value: sanitized.EpayKey })
    }

    if (sanitized.Price !== initial.Price) {
      updates.push({ key: 'Price', value: sanitized.Price })
    }

    if (sanitized.MinTopUp !== initial.MinTopUp) {
      updates.push({ key: 'MinTopUp', value: sanitized.MinTopUp })
    }

    if (sanitized.CustomCallbackAddress !== initial.CustomCallbackAddress) {
      updates.push({
        key: 'CustomCallbackAddress',
        value: sanitized.CustomCallbackAddress,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.PayMethods) !==
      normalizeJsonForComparison(initial.PayMethods)
    ) {
      updates.push({ key: 'PayMethods', value: sanitized.PayMethods })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountOptions) !==
      normalizeJsonForComparison(initial.AmountOptions)
    ) {
      updates.push({
        key: 'payment_setting.amount_options',
        value: sanitized.AmountOptions,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountBonus) !==
      normalizeJsonForComparison(initial.AmountBonus)
    ) {
      updates.push({
        key: 'payment_setting.amount_bonus',
        value: sanitized.AmountBonus,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountBonusLimit) !==
      normalizeJsonForComparison(initial.AmountBonusLimit)
    ) {
      updates.push({
        key: 'payment_setting.amount_bonus_limit',
        value: sanitized.AmountBonusLimit,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountBonusGroups) !==
      normalizeJsonForComparison(initial.AmountBonusGroups)
    ) {
      updates.push({
        key: 'payment_setting.amount_bonus_groups',
        value: sanitized.AmountBonusGroups,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.AmountDiscount) !==
      normalizeJsonForComparison(initial.AmountDiscount)
    ) {
      updates.push({
        key: 'payment_setting.amount_discount',
        value: sanitized.AmountDiscount,
      })
    }

    if (
      sanitized.StripeApiSecret &&
      sanitized.StripeApiSecret !== initial.StripeApiSecret
    ) {
      updates.push({ key: 'StripeApiSecret', value: sanitized.StripeApiSecret })
    }

    if (
      sanitized.StripeWebhookSecret &&
      sanitized.StripeWebhookSecret !== initial.StripeWebhookSecret
    ) {
      updates.push({
        key: 'StripeWebhookSecret',
        value: sanitized.StripeWebhookSecret,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.StripeTopUpPriceIds) !==
      normalizeJsonForComparison(initial.StripeTopUpPriceIds)
    ) {
      updates.push({
        key: 'StripeTopUpPriceIds',
        value: sanitized.StripeTopUpPriceIds,
      })
    }

    if (sanitized.StripeUnitPrice !== initial.StripeUnitPrice) {
      updates.push({ key: 'StripeUnitPrice', value: sanitized.StripeUnitPrice })
    }

    if (sanitized.StripeMinTopUp !== initial.StripeMinTopUp) {
      updates.push({ key: 'StripeMinTopUp', value: sanitized.StripeMinTopUp })
    }

    if (
      sanitized.StripePromotionCodesEnabled !==
      initial.StripePromotionCodesEnabled
    ) {
      updates.push({
        key: 'StripePromotionCodesEnabled',
        value: sanitized.StripePromotionCodesEnabled,
      })
    }

    if (
      sanitized.CreemApiKey &&
      sanitized.CreemApiKey !== initial.CreemApiKey
    ) {
      updates.push({ key: 'CreemApiKey', value: sanitized.CreemApiKey })
    }

    if (
      sanitized.CreemWebhookSecret &&
      sanitized.CreemWebhookSecret !== initial.CreemWebhookSecret
    ) {
      updates.push({
        key: 'CreemWebhookSecret',
        value: sanitized.CreemWebhookSecret,
      })
    }

    if (sanitized.CreemTestMode !== initial.CreemTestMode) {
      updates.push({ key: 'CreemTestMode', value: sanitized.CreemTestMode })
    }

    if (
      normalizeJsonForComparison(sanitized.CreemProducts) !==
      normalizeJsonForComparison(initial.CreemProducts)
    ) {
      updates.push({ key: 'CreemProducts', value: sanitized.CreemProducts })
    }

    if (
      sanitized.PaddleApiKey &&
      sanitized.PaddleApiKey !== initial.PaddleApiKey
    ) {
      updates.push({ key: 'PaddleApiKey', value: sanitized.PaddleApiKey })
    }

    if (
      sanitized.PaddleClientToken &&
      sanitized.PaddleClientToken !== initial.PaddleClientToken
    ) {
      updates.push({
        key: 'PaddleClientToken',
        value: sanitized.PaddleClientToken,
      })
    }

    if (
      sanitized.PaddleWebhookSecret &&
      sanitized.PaddleWebhookSecret !== initial.PaddleWebhookSecret
    ) {
      updates.push({
        key: 'PaddleWebhookSecret',
        value: sanitized.PaddleWebhookSecret,
      })
    }

    if (sanitized.PaddleSandbox !== initial.PaddleSandbox) {
      updates.push({ key: 'PaddleSandbox', value: sanitized.PaddleSandbox })
    }

    if (sanitized.PaddleProductId !== initial.PaddleProductId) {
      updates.push({ key: 'PaddleProductId', value: sanitized.PaddleProductId })
    }

    if (sanitized.PaddleCurrency !== initial.PaddleCurrency) {
      updates.push({ key: 'PaddleCurrency', value: sanitized.PaddleCurrency })
    }

    if (sanitized.PaddleUnitPrice !== initial.PaddleUnitPrice) {
      updates.push({ key: 'PaddleUnitPrice', value: sanitized.PaddleUnitPrice })
    }

    if (sanitized.PaddleMinTopUp !== initial.PaddleMinTopUp) {
      updates.push({ key: 'PaddleMinTopUp', value: sanitized.PaddleMinTopUp })
    }

    if (sanitized.WaffoEnabled !== initial.WaffoEnabled) {
      updates.push({ key: 'WaffoEnabled', value: sanitized.WaffoEnabled })
    }

    if (sanitized.WaffoSandbox !== initial.WaffoSandbox) {
      updates.push({ key: 'WaffoSandbox', value: sanitized.WaffoSandbox })
    }

    if (sanitized.WaffoMerchantId !== initial.WaffoMerchantId) {
      updates.push({ key: 'WaffoMerchantId', value: sanitized.WaffoMerchantId })
    }

    if (sanitized.WaffoCurrency !== initial.WaffoCurrency) {
      updates.push({ key: 'WaffoCurrency', value: sanitized.WaffoCurrency })
    }

    if (sanitized.WaffoUnitPrice !== initial.WaffoUnitPrice) {
      updates.push({ key: 'WaffoUnitPrice', value: sanitized.WaffoUnitPrice })
    }

    if (sanitized.WaffoMinTopUp !== initial.WaffoMinTopUp) {
      updates.push({ key: 'WaffoMinTopUp', value: sanitized.WaffoMinTopUp })
    }

    if (sanitized.WaffoNotifyUrl !== initial.WaffoNotifyUrl) {
      updates.push({ key: 'WaffoNotifyUrl', value: sanitized.WaffoNotifyUrl })
    }

    if (sanitized.WaffoReturnUrl !== initial.WaffoReturnUrl) {
      updates.push({ key: 'WaffoReturnUrl', value: sanitized.WaffoReturnUrl })
    }

    if (sanitized.WaffoPublicCert !== initial.WaffoPublicCert) {
      updates.push({ key: 'WaffoPublicCert', value: sanitized.WaffoPublicCert })
    }

    if (sanitized.WaffoSandboxPublicCert !== initial.WaffoSandboxPublicCert) {
      updates.push({
        key: 'WaffoSandboxPublicCert',
        value: sanitized.WaffoSandboxPublicCert,
      })
    }

    if (sanitized.WaffoApiKey) {
      updates.push({ key: 'WaffoApiKey', value: sanitized.WaffoApiKey })
    }

    if (sanitized.WaffoPrivateKey) {
      updates.push({ key: 'WaffoPrivateKey', value: sanitized.WaffoPrivateKey })
    }

    if (sanitized.WaffoSandboxApiKey) {
      updates.push({
        key: 'WaffoSandboxApiKey',
        value: sanitized.WaffoSandboxApiKey,
      })
    }

    if (sanitized.WaffoSandboxPrivateKey) {
      updates.push({
        key: 'WaffoSandboxPrivateKey',
        value: sanitized.WaffoSandboxPrivateKey,
      })
    }

    if (
      normalizeJsonForComparison(sanitized.WaffoPayMethods) !==
      normalizeJsonForComparison(initial.WaffoPayMethods)
    ) {
      updates.push({ key: 'WaffoPayMethods', value: sanitized.WaffoPayMethods })
    }

    const hasWaffoPancakeChanges =
      sanitized.WaffoPancakeMerchantID !== initial.WaffoPancakeMerchantID ||
      sanitized.WaffoPancakePrivateKey.length > 0 ||
      sanitized.WaffoPancakeReturnURL !== initial.WaffoPancakeReturnURL ||
      waffoPancakeSelection.storeID !== waffoPancakeSavedBinding.storeID ||
      waffoPancakeSelection.productID !== waffoPancakeSavedBinding.productID

    if (updates.length === 0 && !hasWaffoPancakeChanges) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    if (!hasWaffoPancakeChanges) {
      return
    }

    if (!sanitized.WaffoPancakeMerchantID) {
      toast.error(t('Merchant ID is required'))
      return
    }

    if (!waffoPancakeSelection.storeID || !waffoPancakeSelection.productID) {
      toast.error(t('Pick or create both a store and a product before saving.'))
      return
    }

    try {
      const body = await saveWaffoPancakeConfig({
        merchantID: sanitized.WaffoPancakeMerchantID,
        privateKey: sanitized.WaffoPancakePrivateKey,
        returnURL: sanitized.WaffoPancakeReturnURL,
        storeID: waffoPancakeSelection.storeID,
        productID: waffoPancakeSelection.productID,
      })

      if (
        body?.message === 'success' &&
        typeof body.data === 'object' &&
        body.data
      ) {
        const saved = body.data as { product_id: string; store_id: string }
        const savedBinding = {
          storeID: saved.store_id,
          productID: saved.product_id,
        }
        setWaffoPancakeSavedBinding(savedBinding)
        setWaffoPancakeSelection(savedBinding)
        queryClient.invalidateQueries({ queryKey: ['system-options'] })
        toast.success(t('Waffo Pancake settings saved'))
        return
      }

      const reason = typeof body?.data === 'string' ? body.data : undefined
      toast.error(
        reason
          ? `${t('Waffo Pancake save failed')}: ${reason}`
          : t('Waffo Pancake save failed')
      )
    } catch (error) {
      toast.error(
        `${t('Waffo Pancake save failed')}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  const onInvalid = React.useCallback(() => {
    toast.error(
      t(
        'Payment settings need attention. Hover the red icons beside fields for details.'
      )
    )
  }, [t])

  const currentFormValues = form.watch()
  const stripeTopUpPriceRows = React.useMemo(
    () =>
      buildStripeTopUpPriceRows(
        currentFormValues.AmountOptions,
        currentFormValues.StripeTopUpPriceIds,
        {
          10: currentFormValues.StripePriceId,
          20: currentFormValues.StripePriceId20,
          200: currentFormValues.StripePriceId200,
        }
      ),
    [
      currentFormValues.AmountOptions,
      currentFormValues.StripeTopUpPriceIds,
      currentFormValues.StripePriceId,
      currentFormValues.StripePriceId20,
      currentFormValues.StripePriceId200,
    ]
  )
  const handleStripeTopUpPriceIdChange = React.useCallback(
    (amount: number, priceId: string) => {
      setPaymentValue(
        'StripeTopUpPriceIds',
        serializeStripeTopUpPriceIds(
          stripeTopUpPriceRows.map((row) =>
            row.amount === amount ? { ...row, priceId } : row
          )
        )
      )
    },
    [setPaymentValue, stripeTopUpPriceRows]
  )
  const waffoValues: WaffoSettingsValues = {
    WaffoEnabled: currentFormValues.WaffoEnabled,
    WaffoApiKey: currentFormValues.WaffoApiKey,
    WaffoPrivateKey: currentFormValues.WaffoPrivateKey,
    WaffoPublicCert: currentFormValues.WaffoPublicCert,
    WaffoSandboxPublicCert: currentFormValues.WaffoSandboxPublicCert,
    WaffoSandboxApiKey: currentFormValues.WaffoSandboxApiKey,
    WaffoSandboxPrivateKey: currentFormValues.WaffoSandboxPrivateKey,
    WaffoSandbox: currentFormValues.WaffoSandbox,
    WaffoMerchantId: currentFormValues.WaffoMerchantId,
    WaffoCurrency: currentFormValues.WaffoCurrency,
    WaffoUnitPrice: currentFormValues.WaffoUnitPrice,
    WaffoMinTopUp: currentFormValues.WaffoMinTopUp,
    WaffoNotifyUrl: currentFormValues.WaffoNotifyUrl,
    WaffoReturnUrl: currentFormValues.WaffoReturnUrl,
    WaffoPayMethods: JSON.stringify(waffoPayMethods),
  }
  const waffoPancakeValues: WaffoPancakeSettingsValues = {
    WaffoPancakeMerchantID: currentFormValues.WaffoPancakeMerchantID,
    WaffoPancakePrivateKey: currentFormValues.WaffoPancakePrivateKey,
    WaffoPancakeReturnURL: currentFormValues.WaffoPancakeReturnURL,
  }
  const paddleLiveMode = !currentFormValues.PaddleSandbox
  const paddleApiKeyPrefix = paddleLiveMode
    ? PADDLE_LIVE_API_KEY_PREFIX
    : PADDLE_SANDBOX_API_KEY_PREFIX
  const paddleClientTokenPrefix = paddleLiveMode
    ? PADDLE_LIVE_CLIENT_TOKEN_PREFIX
    : PADDLE_SANDBOX_CLIENT_TOKEN_PREFIX
  const paddleApiKeyDescription = paddleLiveMode
    ? t(
        'Use the full Paddle live API key matching {{prefix}}..._..._...; it is 69 characters and contains five underscores. Values starting with only {{incompletePrefix}} are incomplete.',
        {
          prefix: PADDLE_LIVE_API_KEY_PREFIX,
          incompletePrefix: PADDLE_INCOMPLETE_API_KEY_PREFIX,
        }
      )
    : t(
        'Use the full Paddle sandbox API key matching {{prefix}}..._..._...; it is 69 characters and contains five underscores.',
        {
          prefix: PADDLE_SANDBOX_API_KEY_PREFIX,
        }
      )
  const paddleClientTokenDescription = paddleLiveMode
    ? t(
        'Use the Paddle live client-side token matching {{prefix}} plus 27 letters or digits.',
        {
          prefix: PADDLE_LIVE_CLIENT_TOKEN_PREFIX,
        }
      )
    : t(
        'Use the Paddle sandbox client-side token matching {{prefix}} plus 27 letters or digits.',
        { prefix: PADDLE_SANDBOX_CLIENT_TOKEN_PREFIX }
      )
  const getFieldError = React.useCallback(
    (name: keyof PaymentFormValues): React.ReactNode => {
      const message = form.formState.errors[name]?.message
      if (!message) {
        return undefined
      }
      return typeof message === 'string' ? t(message) : String(message)
    },
    [form.formState.errors, t]
  )

  return (
    <SettingsSection title={t('Payment Gateway')}>
      {!complianceConfirmed ? (
        <Alert variant='destructive' className='mb-6'>
          <ShieldAlert className='h-4 w-4' />
          <AlertTitle>{t('Compliance confirmation required')}</AlertTitle>
          <AlertDescription>
            <div className='space-y-3'>
              <p>
                {t(
                  'Payment, redemption codes, subscription plans, and invitation rewards are locked until the root administrator confirms the compliance terms.'
                )}
              </p>
              <ol className='list-decimal space-y-1 pl-5'>
                {complianceStatements.map((statement) => (
                  <li key={statement}>{statement}</li>
                ))}
              </ol>
            </div>
          </AlertDescription>
          <AlertAction>
            <Button
              type='button'
              size='sm'
              variant='destructive'
              onClick={() => setShowComplianceDialog(true)}
            >
              {t('Confirm compliance')}
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <Alert className='mb-6'>
          <AlertTitle>{t('Compliance confirmed')}</AlertTitle>
          <AlertDescription>
            {t('Confirmed at {{time}} by user #{{userId}}', {
              time: complianceDefaults.confirmedAt
                ? new Date(
                    complianceDefaults.confirmedAt * 1000
                  ).toLocaleString()
                : '-',
              userId: complianceDefaults.confirmedBy || '-',
            })}
          </AlertDescription>
        </Alert>
      )}

      <RiskAcknowledgementDialog
        open={showComplianceDialog}
        onOpenChange={setShowComplianceDialog}
        title={t('Confirm compliance terms')}
        description={t(
          'This confirmation unlocks payment, redemption code, subscription plan, and invitation reward features. Please read the statements carefully.'
        )}
        items={complianceStatements}
        requiredText={complianceRequiredText}
        requiredTextParts={complianceRequiredTextParts}
        inputPrompt={t('Please type the following text to confirm:')}
        inputPlaceholder={t('Type the confirmation text here')}
        mismatchHint={t('The entered text does not match the required text.')}
        confirmText={t('Confirm and enable')}
        isLoading={confirmComplianceMutation.isPending}
        onConfirm={() => confirmComplianceMutation.mutate()}
      />

      <Form {...form}>
        <SettingsForm
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className={cn(
            'gap-y-8',
            !complianceConfirmed && 'pointer-events-none opacity-40'
          )}
          data-no-autosubmit='true'
        >
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit, onInvalid)}
            isSaving={updateOption.isPending || isSubmitting}
            saveLabel='Save all settings'
          />
          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-medium'>{t('General Settings')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t('Shared configuration for all payment gateways')}
              </p>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='Price'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Price (local currency / USD)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'How much to charge for each US dollar of balance (Epay)'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='MinTopUp'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Minimum top-up (USD)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Smallest USD amount users can recharge (Epay)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='PayMethods'
              render={({ field }) => (
                <FormItem>
                  <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <FormLabel>{t('Payment methods')}</FormLabel>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setPayMethodsVisualMode(!payMethodsVisualMode)
                      }
                      className='w-full sm:w-auto'
                    >
                      {payMethodsVisualMode ? (
                        <>
                          <Code2 className='mr-2 h-3 w-3' />
                          {t('JSON Editor')}
                        </>
                      ) : (
                        <>
                          <Eye className='mr-2 h-3 w-3' />
                          {t('Visual Editor')}
                        </>
                      )}
                    </Button>
                  </div>
                  <FormControl>
                    {payMethodsVisualMode ? (
                      <PaymentMethodsVisualEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    ) : (
                      <Textarea
                        rows={4}
                        placeholder={t(
                          '[{"name":"支付宝","type":"alipay","color":"#1677FF"}]'
                        )}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    )}
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Configure available payment methods. Provide a JSON array.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid gap-6 md:grid-cols-3 md:items-start'>
              <FormField
                control={form.control}
                name='AmountOptions'
                render={({ field }) => (
                  <FormItem>
                    <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                      <FormLabel>{t('Top-up amount options')}</FormLabel>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setAmountOptionsVisualMode(!amountOptionsVisualMode)
                        }
                        className='w-full sm:w-auto'
                      >
                        {amountOptionsVisualMode ? (
                          <>
                            <Code2 className='mr-2 h-3 w-3' />
                            {t('JSON Editor')}
                          </>
                        ) : (
                          <>
                            <Eye className='mr-2 h-3 w-3' />
                            {t('Visual Editor')}
                          </>
                        )}
                      </Button>
                    </div>
                    <FormControl>
                      {amountOptionsVisualMode ? (
                        <AmountOptionsVisualEditor
                          value={field.value}
                          onChange={field.onChange}
                        />
                      ) : (
                        <Textarea
                          rows={4}
                          placeholder='[10, 20, 50, 100]'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      )}
                    </FormControl>
                    <FormDescription>
                      {t('Preset recharge amounts (JSON array)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='AmountBonus'
                render={({ field }) => (
                  <FormItem>
                    <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                      <FormLabel>{t('Amount bonus')}</FormLabel>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setAmountBonusVisualMode(!amountBonusVisualMode)
                        }
                        className='w-full sm:w-auto'
                      >
                        {amountBonusVisualMode ? (
                          <>
                            <Code2 className='mr-2 h-3 w-3' />
                            {t('JSON Editor')}
                          </>
                        ) : (
                          <>
                            <Eye className='mr-2 h-3 w-3' />
                            {t('Visual Editor')}
                          </>
                        )}
                      </Button>
                    </div>
                    <FormControl>
                      {amountBonusVisualMode ? (
                        <AmountBonusVisualEditor
                          value={field.value}
                          onChange={field.onChange}
                          limitValue={form.watch('AmountBonusLimit')}
                          onLimitChange={(next) =>
                            form.setValue('AmountBonusLimit', next, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          groupsValue={form.watch('AmountBonusGroups')}
                          onGroupsChange={(next) =>
                            form.setValue('AmountBonusGroups', next, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                      ) : (
                        <Textarea
                          rows={4}
                          placeholder='{"20":5,"50":15}'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      )}
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Bonus credit map by recharge amount (JSON object). Values use the same unit as recharge amounts.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!amountBonusVisualMode && (
                <FormField
                  control={form.control}
                  name='AmountBonusLimit'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Bonus claim limit per user')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder='{"20":2,"50":1}'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Per-user lifetime claim limit by recharge amount (JSON object). 0 or unset means unlimited.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!amountBonusVisualMode && (
                <FormField
                  control={form.control}
                  name='AmountBonusGroups'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Eligible user groups')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder='{"20":["plg"],"50":["all"]}'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Whitelist of user groups eligible for each tier (JSON object). Empty array = nobody; ["all"] = every group.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name='AmountDiscount'
                render={({ field }) => (
                  <FormItem>
                    <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                      <FormLabel>{t('Amount discount')}</FormLabel>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setAmountDiscountVisualMode(!amountDiscountVisualMode)
                        }
                        className='w-full sm:w-auto'
                      >
                        {amountDiscountVisualMode ? (
                          <>
                            <Code2 className='mr-2 h-3 w-3' />
                            {t('JSON Editor')}
                          </>
                        ) : (
                          <>
                            <Eye className='mr-2 h-3 w-3' />
                            {t('Visual Editor')}
                          </>
                        )}
                      </Button>
                    </div>
                    <FormControl>
                      {amountDiscountVisualMode ? (
                        <AmountDiscountVisualEditor
                          value={field.value}
                          onChange={field.onChange}
                        />
                      ) : (
                        <Textarea
                          rows={4}
                          placeholder='{"100":0.95,"200":0.9}'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      )}
                    </FormControl>
                    <FormDescription>
                      {t('Discount map by recharge amount (JSON object)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-medium'>{t('Epay Gateway')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t('Configuration for Epay payment integration')}
              </p>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='PayAddress'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Epay endpoint')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('https://pay.example.com')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Base address provided by your Epay service')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='CustomCallbackAddress'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Callback address')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('https://gateway.example.com')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Optional callback override. Leave blank to use server address'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='EpayId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Epay merchant ID')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='10001'
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
                name='EpayKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Epay secret key')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('Enter new key to update')}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Leave blank unless rotating the secret')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-medium'>{t('Stripe Gateway')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t('Configuration for Stripe payment integration')}
              </p>
            </div>

            <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
              <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
              <ul className='list-inside list-disc space-y-1'>
                <li>
                  {t('Webhook URL:')}{' '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {'<ServerAddress>/api/stripe/webhook'}
                  </code>
                </li>
                <li>
                  {t('Required events:')}{' '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {t('checkout.session.completed')}
                  </code>{' '}
                  {t('and')}{' '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {t('checkout.session.expired')}
                  </code>
                  {', '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {t('checkout.session.async_payment_succeeded')}
                  </code>
                  {', '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {t('checkout.session.async_payment_failed')}
                  </code>
                </li>
                <li>
                  {t('Configure at:')}{' '}
                  <a
                    href='https://dashboard.stripe.com/developers'
                    target='_blank'
                    rel='noreferrer'
                    className='underline hover:no-underline'
                  >
                    {t('Stripe Dashboard')}
                  </a>
                </li>
              </ul>
            </div>

            <div className='grid gap-6 md:grid-cols-3'>
              <FormField
                control={form.control}
                name='StripeApiSecret'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('API secret')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('sk_xxx or rk_xxx')}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Stripe API key (leave blank unless updating)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='StripeWebhookSecret'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Webhook secret')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('whsec_xxx')}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Webhook signing secret (leave blank unless updating)'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='StripeTopUpPriceIds'
                render={() => (
                  <>
                    {stripeTopUpPriceRows.length === 0 ? (
                      <div className='text-muted-foreground rounded-lg border border-dashed p-4 text-sm md:col-span-2'>
                        {t(
                          'Add preset recharge amounts to configure Stripe Price IDs.'
                        )}
                      </div>
                    ) : (
                      stripeTopUpPriceRows.map((row) => (
                        <FormItem key={row.amount}>
                          <FormLabel>
                            {t('Price ID')} ({row.amount} USD)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('price_xxx')}
                              value={row.priceId}
                              onChange={(event) =>
                                handleStripeTopUpPriceIdChange(
                                  row.amount,
                                  event.target.value
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      ))
                    )}
                  </>
                )}
              />
            </div>

            <div className='grid gap-6 md:grid-cols-3'>
              <FormField
                control={form.control}
                name='StripeUnitPrice'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Unit price (local currency / USD)')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('e.g., 8 means 8 local currency per USD')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='StripeMinTopUp'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Minimum top-up (USD)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Minimum recharge amount in USD')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='StripePromotionCodesEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>
                        {t('Promotion codes always enabled')}
                      </FormLabel>
                      <FormDescription>
                        {t(
                          'Stripe Checkout always shows the coupon code field. This legacy switch is kept for compatibility.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-medium'>{t('Creem Gateway')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t('Configuration for Creem payment integration')}
              </p>
            </div>

            <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
              <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
              <ul className='list-inside list-disc space-y-1'>
                <li>
                  {t('Webhook URL:')}{' '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {'<ServerAddress>/api/creem/webhook'}
                  </code>
                </li>
                <li>{t('Configure in your Creem dashboard')}</li>
              </ul>
            </div>

            <div className='grid gap-6 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='CreemApiKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('API Key')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('Enter Creem API key')}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Creem API key (leave blank unless updating)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='CreemWebhookSecret'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Webhook Secret')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('Enter webhook secret')}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Webhook signing secret (leave blank unless updating)'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='CreemTestMode'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Test Mode')}</FormLabel>
                    <FormDescription>
                      {t('Enable test mode for Creem payments')}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name='CreemProducts'
              render={({ field }) => (
                <FormItem>
                  <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <FormLabel>{t('Products')}</FormLabel>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        setCreemProductsVisualMode(!creemProductsVisualMode)
                      }
                      className='w-full sm:w-auto'
                    >
                      {creemProductsVisualMode ? (
                        <>
                          <Code2 className='mr-2 h-3 w-3' />
                          {t('JSON Editor')}
                        </>
                      ) : (
                        <>
                          <Eye className='mr-2 h-3 w-3' />
                          {t('Visual Editor')}
                        </>
                      )}
                    </Button>
                  </div>
                  <FormControl>
                    {creemProductsVisualMode ? (
                      <CreemProductsVisualEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    ) : (
                      <Textarea
                        rows={4}
                        placeholder='[{"name":"Basic","productId":"prod_xxx","price":10,"quota":500000,"currency":"USD"}]'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    )}
                  </FormControl>
                  <FormDescription>
                    {t('Configure Creem products. Provide a JSON array.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <div className='space-y-4'>
            <div>
              <h3 className='text-lg font-medium'>{t('Paddle Gateway')}</h3>
              <p className='text-muted-foreground text-sm'>
                {t('Configuration for Paddle Billing hosted checkout')}
              </p>
            </div>

            <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
              <p className='mb-2 font-medium'>{t('Webhook Configuration:')}</p>
              <ul className='list-inside list-disc space-y-1'>
                <li>
                  {t('Webhook URL:')}{' '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {'<ServerAddress>/api/paddle/webhook'}
                  </code>
                </li>
                <li>
                  {t('Checkout return URL:')}{' '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {'<ServerAddress>/console/topup'}
                  </code>
                </li>
                <li>
                  {t('Required events:')}{' '}
                  <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
                    {'transaction.paid'}
                  </code>
                </li>
              </ul>
            </div>

            <FormField
              control={form.control}
              name='PaddleSandbox'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabelWithHelp
                      label={t('Paddle Environment')}
                      helpLabel={t('Show help')}
                      help={
                        <div className='space-y-1'>
                          <p>
                            {t(
                              'Turn on to use Paddle live credentials and production payments. Turn off to use sandbox credentials and test payments.'
                            )}
                          </p>
                          <p>
                            {t(
                              'Live checkout requires a Default Payment Link in Paddle Dashboard > Checkout settings. Set it to an approved website URL, such as {{url}}.',
                              {
                                url: '<ServerAddress>/console/topup',
                              }
                            )}
                          </p>
                          <p>
                            {t(
                              'After switching sandbox or live mode, save settings and reload the wallet page before testing checkout.'
                            )}
                          </p>
                        </div>
                      }
                    />
                    <FormDescription>
                      {paddleLiveMode ? t('Live Mode') : t('Sandbox Mode')}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={!field.value}
                      onCheckedChange={(checked) => field.onChange(!checked)}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <div className='grid gap-6 md:grid-cols-2 xl:grid-cols-4'>
              <FormField
                control={form.control}
                name='PaddleApiKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabelWithHelp
                      label={t('API Key')}
                      helpLabel={t('Show help')}
                      errorLabel={t('Error')}
                      error={getFieldError('PaddleApiKey')}
                      help={
                        <>
                          {paddleApiKeyDescription}{' '}
                          {t('Leave blank unless updating.')}
                        </>
                      }
                    />
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={paddleApiKeyPrefix}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage className='sr-only' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='PaddleClientToken'
                render={({ field }) => (
                  <FormItem>
                    <FormLabelWithHelp
                      label={t('Client-side Token')}
                      helpLabel={t('Show help')}
                      errorLabel={t('Error')}
                      error={getFieldError('PaddleClientToken')}
                      help={
                        <>
                          {paddleClientTokenDescription}{' '}
                          {t(
                            'Required by Paddle.js checkout. Leave blank unless updating.'
                          )}
                        </>
                      }
                    />
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={paddleClientTokenPrefix}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage className='sr-only' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='PaddleWebhookSecret'
                render={({ field }) => (
                  <FormItem>
                    <FormLabelWithHelp
                      label={t('Webhook Secret')}
                      helpLabel={t('Show help')}
                      errorLabel={t('Error')}
                      error={getFieldError('PaddleWebhookSecret')}
                      help={t(
                        'Use the endpoint signing secret from Paddle notifications. It matches {{secretPrefix}}..._..., not {{idPrefix}}. Leave blank unless updating.',
                        {
                          secretPrefix: PADDLE_WEBHOOK_SECRET_PREFIX,
                          idPrefix: PADDLE_NOTIFICATION_ID_PREFIX,
                        }
                      )}
                    />
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={PADDLE_WEBHOOK_SECRET_PREFIX}
                        autoComplete='new-password'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage className='sr-only' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='PaddleProductId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabelWithHelp
                      label={t('Product ID')}
                      helpLabel={t('Show help')}
                      errorLabel={t('Error')}
                      error={getFieldError('PaddleProductId')}
                      help={t(
                        'Paddle product used for wallet top-ups. It matches {{prefix}} plus 26 lowercase letters or digits.',
                        {
                          prefix: PADDLE_PRODUCT_ID_PREFIX,
                        }
                      )}
                    />
                    <FormControl>
                      <Input
                        placeholder='pro_xxx'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage className='sr-only' />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid gap-6 md:grid-cols-3'>
              <FormField
                control={form.control}
                name='PaddleCurrency'
                render={({ field }) => (
                  <FormItem>
                    <FormLabelWithHelp
                      label={t('Currency')}
                      helpLabel={t('Show help')}
                      errorLabel={t('Error')}
                      error={getFieldError('PaddleCurrency')}
                      help={t('Paddle transaction currency code')}
                    />
                    <FormControl>
                      <Input
                        placeholder='USD'
                        {...field}
                        onChange={(event) =>
                          field.onChange(event.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage className='sr-only' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='PaddleUnitPrice'
                render={({ field }) => (
                  <FormItem>
                    <FormLabelWithHelp
                      label={t('Unit price (payment currency / USD)')}
                      helpLabel={t('Show help')}
                      errorLabel={t('Error')}
                      error={getFieldError('PaddleUnitPrice')}
                      help={t('e.g., 1 means 1 payment currency per USD')}
                    />
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormMessage className='sr-only' />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='PaddleMinTopUp'
                render={({ field }) => (
                  <FormItem>
                    <FormLabelWithHelp
                      label={t('Minimum top-up (USD)')}
                      helpLabel={t('Show help')}
                      errorLabel={t('Error')}
                      error={getFieldError('PaddleMinTopUp')}
                      help={t('Smallest USD amount users can recharge')}
                    />
                    <FormControl>
                      <Input
                        type='number'
                        step='1'
                        min={1}
                        {...safeNumberFieldProps(field)}
                      />
                    </FormControl>
                    <FormMessage className='sr-only' />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          <WaffoPancakeSettingsSection
            defaultValues={waffoPancakeDefaultValues}
            values={waffoPancakeValues}
            onValueChange={setWaffoPancakeValue}
            selectedBinding={waffoPancakeSelection}
            savedBinding={waffoPancakeSavedBinding}
            onSelectedBindingChange={setWaffoPancakeSelection}
          />

          <Separator />

          <WaffoSettingsSection
            values={waffoValues}
            onValueChange={setWaffoValue}
            payMethods={waffoPayMethods}
            onPayMethodsChange={setWaffoPayMethods}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
