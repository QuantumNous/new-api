import { useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown } from 'lucide-react'
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

const modelDialogSchema = z.object({
  name: z.string().min(1, 'Model name is required'),
  price: z.string().optional(),
  ratio: z.string().optional(),
  cacheRatio: z.string().optional(),
  completionRatio: z.string().optional(),
  imageRatio: z.string().optional(),
  audioRatio: z.string().optional(),
  audioCompletionRatio: z.string().optional(),
})

type ModelDialogFormValues = z.infer<typeof modelDialogSchema>

type PricingMode = 'per-token' | 'per-request'
type PricingSubMode = 'ratio' | 'price'

export type ModelRatioData = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
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
  const [pricingMode, setPricingMode] = useState<PricingMode>('per-token')
  const [pricingSubMode, setPricingSubMode] = useState<PricingSubMode>('ratio')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [promptPrice, setPromptPrice] = useState('')
  const [completionPrice, setCompletionPrice] = useState('')
  const isEditMode = !!editData

  const form = useForm<ModelDialogFormValues>({
    resolver: zodResolver(modelDialogSchema),
    defaultValues: {
      name: '',
      price: '',
      ratio: '',
      cacheRatio: '',
      completionRatio: '',
      imageRatio: '',
      audioRatio: '',
      audioCompletionRatio: '',
    },
  })

  useEffect(() => {
    if (editData) {
      form.reset(editData)
      // Determine pricing mode based on existing data
      if (editData.price && editData.price !== '') {
        setPricingMode('per-request')
      } else {
        setPricingMode('per-token')
        // Calculate prompt/completion prices from ratios if available
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
        completionRatio: '',
        imageRatio: '',
        audioRatio: '',
        audioCompletionRatio: '',
      })
      setPricingMode('per-token')
      setPricingSubMode('ratio')
      setPromptPrice('')
      setCompletionPrice('')
      setAdvancedOpen(false)
    }
  }, [editData, form, open])

  const handleSubmit = (values: ModelDialogFormValues) => {
    const data: ModelRatioData = {
      name: values.name,
    }

    if (pricingMode === 'per-request') {
      data.price = values.price || ''
    } else {
      data.ratio = values.ratio || ''
      data.cacheRatio = values.cacheRatio || ''
      data.completionRatio = values.completionRatio || ''
      data.imageRatio = values.imageRatio || ''
      data.audioRatio = values.audioRatio || ''
      data.audioCompletionRatio = values.audioCompletionRatio || ''
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
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit model' : 'Add model'}</DialogTitle>
          <DialogDescription>
            Configure pricing ratios for a specific model.
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
                  <FormLabel>Model name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='gpt-4'
                      {...field}
                      disabled={isEditMode}
                    />
                  </FormControl>
                  <FormDescription>
                    The exact model identifier as used in API requests.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='space-y-4'>
              <Label>Pricing mode</Label>
              <RadioGroup
                value={pricingMode}
                onValueChange={(value) => setPricingMode(value as PricingMode)}
              >
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='per-token' id='per-token' />
                  <Label htmlFor='per-token' className='font-normal'>
                    Per-token (ratio based)
                  </Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem value='per-request' id='per-request' />
                  <Label htmlFor='per-request' className='font-normal'>
                    Per-request (fixed price)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {pricingMode === 'per-request' ? (
              <FormField
                control={form.control}
                name='price'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fixed price (USD)</FormLabel>
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
                      Cost in USD per request, regardless of tokens used.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                <div className='space-y-4'>
                  <Label>Input mode</Label>
                  <RadioGroup
                    value={pricingSubMode}
                    onValueChange={(value) =>
                      setPricingSubMode(value as PricingSubMode)
                    }
                  >
                    <div className='flex items-center space-x-2'>
                      <RadioGroupItem value='ratio' id='ratio' />
                      <Label htmlFor='ratio' className='font-normal'>
                        Ratio mode
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <RadioGroupItem value='price' id='price' />
                      <Label htmlFor='price' className='font-normal'>
                        Price mode (USD per 1M tokens)
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
                          <FormLabel>Model ratio</FormLabel>
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
                              ? `Calculated price: $${(parseFloat(field.value) * 2).toFixed(4)} per 1M tokens`
                              : 'Multiplier for prompt tokens.'}
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
                          <FormLabel>Completion ratio</FormLabel>
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
                              ? `Calculated price: $${(parseFloat(promptPrice) * parseFloat(field.value)).toFixed(4)} per 1M tokens`
                              : 'Multiplier for completion tokens.'}
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
                        <Label>Prompt price ($/1M tokens)</Label>
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
                            ? `Calculated ratio: ${(parseFloat(promptPrice) / 2).toFixed(4)}`
                            : 'Enter Input price to calculate ratio'}
                        </p>
                      </div>

                      <div className='space-y-2'>
                        <Label>Completion price ($/1M tokens)</Label>
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
                            ? `Calculated ratio: ${(parseFloat(completionPrice) / parseFloat(promptPrice)).toFixed(4)}`
                            : 'Enter Completion price to calculate ratio'}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type='button'
                      variant='outline'
                      className='flex w-full items-center justify-between'
                    >
                      Advanced options
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          advancedOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className='space-y-6 pt-6'>
                    <FormField
                      control={form.control}
                      name='cacheRatio'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cache ratio</FormLabel>
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
                            Discount ratio for cache hits.
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
                          <FormLabel>Image ratio</FormLabel>
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
                            Multiplier for image processing.
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
                          <FormLabel>Audio ratio</FormLabel>
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
                            Multiplier for audio inputs.
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
                          <FormLabel>Audio completion ratio</FormLabel>
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
                            Multiplier for audio outputs.
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
                Cancel
              </Button>
              <Button type='submit'>{isEditMode ? 'Update' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
