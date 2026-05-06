import { useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { TieredPricingEditor } from './tiered-pricing-editor'

const createModelDialogSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Model name is required')),
    price: z.string().optional(),
    ratio: z.string().optional(),
    cacheRatio: z.string().optional(),
    createCacheRatio: z.string().optional(),
    completionRatio: z.string().optional(),
    imageRatio: z.string().optional(),
    audioRatio: z.string().optional(),
    audioCompletionRatio: z.string().optional(),
  })

type ModelDialogFormValues = z.infer<ReturnType<typeof createModelDialogSchema>>

type PricingMode = 'per-token' | 'per-request' | 'tiered_expr'
type PricingSubMode = 'ratio' | 'price'

export type ModelRatioData = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: 'per-token' | 'per-request' | 'tiered_expr'
  billingExpr?: string
  requestRuleExpr?: string
}

type ModelRatioDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: ModelRatioData) => void
  editData?: ModelRatioData | null
}

export function ModelRatioDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: ModelRatioDialogProps) {
  const { t } = useTranslation()
  const [pricingMode, setPricingMode] = useState<PricingMode>('per-token')
  const [pricingSubMode, setPricingSubMode] = useState<PricingSubMode>('ratio')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [promptPrice, setPromptPrice] = useState('')
  const [completionPrice, setCompletionPrice] = useState('')
  const [billingExpr, setBillingExpr] = useState('')
  const [requestRuleExpr, setRequestRuleExpr] = useState('')
  const isEditMode = !!editData

  const form = useForm<ModelDialogFormValues>({
    resolver: zodResolver(createModelDialogSchema(t)),
    defaultValues: {
      name: '',
      price: '',
      ratio: '',
      cacheRatio: '',
      createCacheRatio: '',
      completionRatio: '',
      imageRatio: '',
      audioRatio: '',
      audioCompletionRatio: '',
    },
  })

  useEffect(() => {
    if (editData) {
      form.reset(editData)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBillingExpr(editData.billingExpr || '')
      setRequestRuleExpr(editData.requestRuleExpr || '')

      if (editData.billingMode === 'tiered_expr') {
        setPricingMode('tiered_expr')
      } else if (editData.price && editData.price !== '') {
        setPricingMode('per-request')
      } else {
        setPricingMode('per-token')
        if (editData.ratio) {
          const tokenPrice = parseFloat(editData.ratio) * 2
          setPromptPrice(tokenPrice.toString())
          if (editData.completionRatio) {
            const compPrice = tokenPrice * parseFloat(editData.completionRatio)
            setCompletionPrice(compPrice.toString())
          }
        }
      }
    } else {
      form.reset({
        name: '',
        price: '',
        ratio: '',
        cacheRatio: '',
        createCacheRatio: '',
        completionRatio: '',
        imageRatio: '',
        audioRatio: '',
        audioCompletionRatio: '',
      })
      setPricingMode('per-token')
      setPricingSubMode('ratio')
      setPromptPrice('')
      setCompletionPrice('')
      setBillingExpr('')
      setRequestRuleExpr('')
      setAdvancedOpen(false)
    }
  }, [editData, form, open])

  const handleSubmit = (values: ModelDialogFormValues) => {
    // Always pass through every field. The visual editor decides what to
    // persist based on `billingMode`, and tiered_expr models also keep the
    // ratio/price values as fallback during multi-instance sync delays
    // (the backend's ModelPriceHelper checks billing_mode first, so these
    // fallbacks only kick in when billing_setting hasn't propagated yet).
    const data: ModelRatioData = {
      name: values.name,
      billingMode: pricingMode,
      price: values.price || '',
      ratio: values.ratio || '',
      cacheRatio: values.cacheRatio || '',
      createCacheRatio: values.createCacheRatio || '',
      completionRatio: values.completionRatio || '',
      imageRatio: values.imageRatio || '',
      audioRatio: values.audioRatio || '',
      audioCompletionRatio: values.audioCompletionRatio || '',
    }

    if (pricingMode === 'tiered_expr') {
      data.billingExpr = billingExpr
      data.requestRuleExpr = requestRuleExpr
    }

    onSave(data)
    form.reset()
    onOpenChange(false)
  }

  const validateNumber = (value: string) => {
    if (value === '') return true
    return !isNaN(parseFloat(value))
  }

  const handlePromptPriceChange = (value: string) => {
    setPromptPrice(value)
    if (value && !isNaN(parseFloat(value))) {
      const ratio = parseFloat(value) / 2
      form.setValue('ratio', ratio.toString())
    } else {
      form.setValue('ratio', '')
    }
  }

  const handleCompletionPriceChange = (value: string) => {
    setCompletionPrice(value)
    if (
      value &&
      !isNaN(parseFloat(value)) &&
      promptPrice &&
      !isNaN(parseFloat(promptPrice)) &&
      parseFloat(promptPrice) > 0
    ) {
      const completionRatio = parseFloat(value) / parseFloat(promptPrice)
      form.setValue('completionRatio', completionRatio.toString())
    } else {
      form.setValue('completionRatio', '')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[680px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('Edit model') : t('Add model')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure pricing ratios for a specific model.')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-6'
            autoComplete='off'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Model name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('gpt-4')}
                      {...field}
                      disabled={isEditMode}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('The exact model identifier as used in API requests.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-4'>
              <Label>{t('Pricing mode')}</Label>
              <RadioGroup
                value={pricingMode}
                onValueChange={(value) => setPricingMode(value as PricingMode)}
              >
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='per-token' id='per-token' />
                  <Label htmlFor='per-token' className='font-normal'>
                    {t('Per-token (ratio based)')}
                  </Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='per-request' id='per-request' />
                  <Label htmlFor='per-request' className='font-normal'>
                    {t('Per-request (fixed price)')}
                  </Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='tiered_expr' id='tiered_expr' />
                  <Label htmlFor='tiered_expr' className='font-normal'>
                    {t('Tiered (billing expression)')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {pricingMode === 'tiered_expr' ? (
              <TieredPricingEditor
                modelName={form.getValues('name')}
                billingExpr={billingExpr}
                requestRuleExpr={requestRuleExpr}
                onBillingExprChange={setBillingExpr}
                onRequestRuleExprChange={setRequestRuleExpr}
              />
            ) : pricingMode === 'per-request' ? (
              <FormField
                control={form.control}
                name='price'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Fixed price (USD)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        placeholder='0.01'
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value
                          if (validateNumber(value)) {
                            field.onChange(value)
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Cost in USD per request, regardless of tokens used.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                <div className='space-y-4'>
                  <Label>{t('Input mode')}</Label>
                  <RadioGroup
                    value={pricingSubMode}
                    onValueChange={(value) =>
                      setPricingSubMode(value as PricingSubMode)
                    }
                  >
                    <div className='flex items-center space-x-2'>
                      <RadioGroupItem value='ratio' id='ratio' />
                      <Label htmlFor='ratio' className='font-normal'>
                        {t('Ratio mode')}
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <RadioGroupItem value='price' id='price' />
                      <Label htmlFor='price' className='font-normal'>
                        {t('Price mode (USD per 1M tokens)')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {pricingSubMode === 'ratio' ? (
                  <>
                    <FormField
                      control={form.control}
                      name='ratio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Model ratio')}</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='1.0'
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (validateNumber(value)) {
                                  field.onChange(value)
                                  if (value) {
                                    setPromptPrice(
                                      (parseFloat(value) * 2).toString()
                                    )
                                  } else {
                                    setPromptPrice('')
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {field.value && !isNaN(parseFloat(field.value))
                              ? t(
                                  'Calculated price: ${{price}} per 1M tokens',
                                  {
                                    price: (
                                      parseFloat(field.value) * 2
                                    ).toFixed(4),
                                  }
                                )
                              : t('Multiplier for prompt tokens.')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='completionRatio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Completion ratio')}</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='1.0'
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (validateNumber(value)) {
                                  field.onChange(value)
                                  const ratio = form.getValues('ratio')
                                  if (value && ratio) {
                                    const compPrice =
                                      parseFloat(ratio) * 2 * parseFloat(value)
                                    setCompletionPrice(compPrice.toString())
                                  } else {
                                    setCompletionPrice('')
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {field.value &&
                            !isNaN(parseFloat(field.value)) &&
                            promptPrice &&
                            !isNaN(parseFloat(promptPrice))
                              ? t(
                                  'Calculated price: ${{price}} per 1M tokens',
                                  {
                                    price: (
                                      parseFloat(promptPrice) *
                                      parseFloat(field.value)
                                    ).toFixed(4),
                                  }
                                )
                              : t('Multiplier for completion tokens.')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : (
                  <>
                    <div className='space-y-4'>
                      <div className='space-y-2'>
                        <Label>{t('Prompt price ($/1M tokens)')}</Label>
                        <Input
                          type='text'
                          placeholder='2.0'
                          value={promptPrice}
                          onChange={(e) =>
                            handlePromptPriceChange(e.target.value)
                          }
                        />
                        <p className='text-muted-foreground text-sm'>
                          {promptPrice && !isNaN(parseFloat(promptPrice))
                            ? t('Calculated ratio: {{ratio}}', {
                                ratio: (parseFloat(promptPrice) / 2).toFixed(4),
                              })
                            : t('Enter Input price to calculate ratio')}
                        </p>
                      </div>

                      <div className='space-y-2'>
                        <Label>{t('Completion price ($/1M tokens)')}</Label>
                        <Input
                          type='text'
                          placeholder='4.0'
                          value={completionPrice}
                          onChange={(e) =>
                            handleCompletionPriceChange(e.target.value)
                          }
                        />
                        <p className='text-muted-foreground text-sm'>
                          {completionPrice &&
                          !isNaN(parseFloat(completionPrice)) &&
                          promptPrice &&
                          !isNaN(parseFloat(promptPrice)) &&
                          parseFloat(promptPrice) > 0
                            ? t('Calculated ratio: {{ratio}}', {
                                ratio: (
                                  parseFloat(completionPrice) /
                                  parseFloat(promptPrice)
                                ).toFixed(4),
                              })
                            : t('Enter Completion price to calculate ratio')}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger
                    render={
                      <Button
                        type='button'
                        variant='outline'
                        className='flex w-full items-center justify-between'
                      />
                    }
                  >
                    {t('Advanced options')}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        advancedOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className='space-y-6 pt-6'>
                    <FormField
                      control={form.control}
                      name='cacheRatio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Cache ratio')}</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='0.1'
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (validateNumber(value)) {
                                  field.onChange(value)
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('Discount ratio for cache hits.')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='createCacheRatio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Create cache ratio')}</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='1.25'
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (validateNumber(value)) {
                                  field.onChange(value)
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {t(
                              'Ratio applied when creating cache entries for supported models.'
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='imageRatio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Image ratio')}</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='1.0'
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (validateNumber(value)) {
                                  field.onChange(value)
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('Multiplier for image processing.')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='audioRatio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Audio ratio')}</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='1.0'
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (validateNumber(value)) {
                                  field.onChange(value)
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('Multiplier for audio inputs.')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='audioCompletionRatio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Audio completion ratio')}</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='1.0'
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value
                                if (validateNumber(value)) {
                                  field.onChange(value)
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('Multiplier for audio outputs.')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit'>
                {isEditMode ? t('Update') : t('Add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
