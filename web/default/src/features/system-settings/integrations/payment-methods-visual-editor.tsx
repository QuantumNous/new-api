import { useState, useMemo } from 'react'
import { Lightbulb, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isArray } from '../utils/json-validators'
import {
  PaymentMethodDialog,
  type PaymentMethodData,
} from './payment-method-dialog'

type PaymentMethodsVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

const PAYMENT_TEMPLATES = [
  {
    name: 'Alipay',
    template: {
      color: 'rgba(var(--semi-blue-5), 1)',
      name: '支付宝',
      type: 'alipay',
    },
  },
  {
    name: 'WeChat Pay',
    template: {
      color: 'rgba(var(--semi-green-5), 1)',
      name: '微信',
      type: 'wxpay',
    },
  },
  {
    name: 'Stripe',
    template: {
      color: 'rgba(var(--semi-green-5), 1)',
      name: 'Stripe',
      type: 'stripe',
    },
  },
  {
    name: 'Custom',
    template: {
      color: 'black',
      min_topup: '50',
      name: '自定义1',
      type: 'custom1',
    },
  },
]

export function PaymentMethodsVisualEditor({
  value,
  onChange,
}: PaymentMethodsVisualEditorProps) {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<PaymentMethodData | null>(null)

  const paymentMethods = useMemo(() => {
    const parsed = safeJsonParseWithValidation<unknown[]>(value, {
      fallback: [],
      validator: isArray,
      validatorMessage: 'Payment methods must be a JSON array',
      context: 'payment methods',
    })

    return parsed.filter(
      (item): item is PaymentMethodData =>
        typeof item === 'object' &&
        item !== null &&
        'name' in item &&
        'type' in item &&
        'color' in item &&
        typeof item.name === 'string' &&
        typeof item.type === 'string' &&
        typeof item.color === 'string'
    )
  }, [value])

  const filteredMethods = useMemo(() => {
    if (!searchText) return paymentMethods
    const lowerSearch = searchText.toLowerCase()
    return paymentMethods.filter(
      (method) =>
        method.name.toLowerCase().includes(lowerSearch) ||
        method.type.toLowerCase().includes(lowerSearch)
    )
  }, [paymentMethods, searchText])

  const handleSave = (data: PaymentMethodData) => {
    const parsed = safeJsonParseWithValidation<unknown[]>(value, {
      fallback: [],
      validator: isArray,
      silent: true,
    })

    const updatedArray = [...parsed]

    if (editData) {
      const index = updatedArray.findIndex(
        (item): item is PaymentMethodData =>
          typeof item === 'object' &&
          item !== null &&
          'name' in item &&
          'type' in item &&
          item.name === editData.name &&
          item.type === editData.type
      )
      if (index !== -1) {
        updatedArray[index] = data
      } else {
        updatedArray.push(data)
      }
    } else {
      updatedArray.push(data)
    }

    onChange(JSON.stringify(updatedArray, null, 2))
  }

  const handleDelete = (method: PaymentMethodData) => {
    const parsed = safeJsonParseWithValidation<unknown[]>(value, {
      fallback: [],
      validator: isArray,
      silent: true,
    })

    const updatedArray = parsed.filter(
      (item) =>
        !(
          typeof item === 'object' &&
          item !== null &&
          'name' in item &&
          'type' in item &&
          item.name === method.name &&
          item.type === method.type
        )
    )

    onChange(JSON.stringify(updatedArray, null, 2))
  }

  const handleEdit = (method: PaymentMethodData) => {
    setEditData(method)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditData(null)
    setDialogOpen(true)
  }

  const handleInsertTemplate = (template: PaymentMethodData) => {
    const parsed = safeJsonParseWithValidation<unknown[]>(value, {
      fallback: [],
      validator: isArray,
      silent: true,
    })

    // Check if template already exists
    const exists = parsed.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        'name' in item &&
        item.type === template.type &&
        item.name === template.name
    )

    if (!exists) {
      parsed.push(template)
      onChange(JSON.stringify(parsed, null, 2))
    }
  }

  const getColorPreview = (color: string) => {
    // For CSS variables, show a placeholder
    if (color.includes('var(--')) {
      return null
    }
    return color
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
          <Input
            placeholder={t('Search payment methods...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className='pl-9'
          />
        </div>
        <div className='flex gap-2'>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant='outline' className='flex-1 sm:flex-none' />
              }
            >
              <Lightbulb className='h-4 w-4 sm:mr-2' />
              <span className='sm:inline'>{t('Templates')}</span>
            </PopoverTrigger>
            <PopoverContent className='w-60'>
              <div className='space-y-2'>
                <p className='text-muted-foreground text-xs'>
                  {t('Quick insert common payment methods')}
                </p>
                <div className='space-y-1'>
                  {PAYMENT_TEMPLATES.map((item) => (
                    <Button
                      key={item.name}
                      type='button'
                      variant='ghost'
                      className='w-full justify-start text-sm'
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleInsertTemplate(item.template)
                      }}
                    >
                      <Plus className='mr-2 h-3 w-3' />
                      {item.name}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type='button'
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleAdd()
            }}
            className='flex-1 sm:flex-none'
          >
            <Plus className='h-4 w-4 sm:mr-2' />
            <span className='sm:inline'>{t('Add method')}</span>
          </Button>
        </div>
      </div>

      {filteredMethods.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
          {searchText
            ? t('No payment methods match your search')
            : t(
                'No payment methods configured. Click "Add method" or use templates to get started.'
              )}
        </div>
      ) : (
        <div className='rounded-md border'>
          {/* Desktop table view */}
          <div className='hidden md:block'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead>{t('Type')}</TableHead>
                  <TableHead>{t('Color')}</TableHead>
                  <TableHead>{t('Min Top-up')}</TableHead>
                  <TableHead className='text-right'>{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMethods.map((method, index) => {
                  const colorPreview = getColorPreview(method.color)
                  return (
                    <TableRow key={`${method.type}-${index}`}>
                      <TableCell className='font-medium'>
                        {method.name}
                      </TableCell>
                      <TableCell>
                        <code className='bg-muted rounded px-1.5 py-0.5 text-xs'>
                          {method.type}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          {colorPreview && (
                            <div
                              className='size-5 shrink-0 rounded border'
                              style={{ backgroundColor: colorPreview }}
                            />
                          )}
                          <span className='text-muted-foreground truncate font-mono text-xs'>
                            {method.color}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {method.min_topup ? (
                          <span className='font-mono text-sm'>
                            {method.min_topup}
                          </span>
                        ) : (
                          <span className='text-muted-foreground text-sm'>
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleEdit(method)
                            }}
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDelete(method)
                            }}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card view */}
          <div className='divide-y md:hidden'>
            {filteredMethods.map((method, index) => {
              const colorPreview = getColorPreview(method.color)
              return (
                <div key={`${method.type}-${index}`} className='p-4'>
                  <div className='mb-3 flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='mb-1 font-medium'>{method.name}</div>
                      <code className='bg-muted rounded px-1.5 py-0.5 text-xs'>
                        {method.type}
                      </code>
                    </div>
                    <div className='flex gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleEdit(method)
                        }}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDelete(method)
                        }}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                  <div className='space-y-2 text-sm'>
                    <div className='flex items-center gap-2'>
                      <span className='text-muted-foreground min-w-20'>
                        {t('Color:')}
                      </span>
                      <div className='flex items-center gap-2'>
                        {colorPreview && (
                          <div
                            className='size-5 shrink-0 rounded border'
                            style={{ backgroundColor: colorPreview }}
                          />
                        )}
                        <span className='text-muted-foreground truncate font-mono text-xs'>
                          {method.color}
                        </span>
                      </div>
                    </div>
                    {method.min_topup && (
                      <div className='flex items-center gap-2'>
                        <span className='text-muted-foreground min-w-20'>
                          {t('Min Top-up:')}
                        </span>
                        <span className='font-mono'>{method.min_topup}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <PaymentMethodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editData={editData}
      />
    </div>
  )
}
