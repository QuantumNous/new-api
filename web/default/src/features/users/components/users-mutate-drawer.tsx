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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import {
  createUser,
  updateUser,
  getUser,
  getAssignableUserGroups,
  getUserInvoiceProfile,
  updateUserInvoiceProfile,
} from '../api'
import { BINDING_FIELDS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  userFormSchema,
  type UserFormValues,
  USER_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformUserToFormDefaults,
} from '../lib'
import { type User, type UserInvoiceProfile } from '../types'
import { UserQuotaDialog } from './user-quota-dialog'
import { useUsers } from './users-provider'

type UsersMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: User
}

const EMPTY_INVOICE_PROFILE: UserInvoiceProfile = {
  company_name: '',
  billing_email: '',
  tax_id_type: '',
  tax_id: '',
  country: '',
  state: '',
  city: '',
  address_line1: '',
  address_line2: '',
  postal_code: '',
  phone: '',
}

function normalizeInvoiceProfile(
  profile: UserInvoiceProfile
): UserInvoiceProfile {
  return {
    company_name: profile.company_name.trim(),
    billing_email: profile.billing_email.trim(),
    tax_id_type: profile.tax_id_type?.trim(),
    tax_id: profile.tax_id?.trim(),
    country: profile.country.trim().toUpperCase(),
    state: profile.state?.trim(),
    city: profile.city?.trim(),
    address_line1: profile.address_line1.trim(),
    address_line2: profile.address_line2?.trim(),
    postal_code: profile.postal_code?.trim(),
    phone: profile.phone?.trim(),
  }
}

function getInvoiceProfileValidationError(
  profile: UserInvoiceProfile
): string | null {
  const normalized = normalizeInvoiceProfile(profile)
  if (!normalized.company_name) return 'Company name is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.billing_email)) {
    return 'Billing email is invalid'
  }
  if (!normalized.country) return 'Country is required'
  if (!normalized.address_line1) return 'Address is required'
  return null
}

export function UsersMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: UsersMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useUsers()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [invoiceProfile, setInvoiceProfile] = useState<UserInvoiceProfile>(
    EMPTY_INVOICE_PROFILE
  )
  const [invoiceSaving, setInvoiceSaving] = useState(false)

  // Fetch the user identity groups an admin can assign (topup group ratio keys),
  // not all ratio groups. Groups can be edited elsewhere (system settings) right
  // before opening this drawer, so always refetch on open instead of serving a
  // stale cached list.
  const { data: groupsData } = useQuery({
    queryKey: ['assignable-user-groups'],
    queryFn: getAssignableUserGroups,
    enabled: open,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const groups = groupsData?.data || []

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: USER_FORM_DEFAULT_VALUES,
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      // For update, fetch fresh data
      getUser(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformUserToFormDefaults(result.data))
        }
      })
      getUserInvoiceProfile(currentRow.id).then((result) => {
        if (result.success) {
          setInvoiceProfile({
            ...EMPTY_INVOICE_PROFILE,
            ...(result.data || {}),
          })
        }
      })
    } else if (open && !isUpdate) {
      // For create, reset to defaults
      form.reset(USER_FORM_DEFAULT_VALUES)
      setInvoiceProfile(EMPTY_INVOICE_PROFILE)
    }
  }, [open, isUpdate, currentRow, form])

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const currentQuotaRaw = form.watch('quota_dollars') || 0

  const onSubmit = async (data: UserFormValues) => {
    if (!isUpdate) {
      const passwordLength = data.password?.length || 0
      if (passwordLength < 8 || passwordLength > 20) {
        form.setError('password', {
          type: 'manual',
          message: t('Password must be between 8 and 20 characters'),
        })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(data, currentRow?.id)
      const result = isUpdate
        ? await updateUser(payload as typeof payload & { id: number })
        : await createUser(payload)

      if (result.success) {
        toast.success(
          isUpdate
            ? t(SUCCESS_MESSAGES.USER_UPDATED)
            : t(SUCCESS_MESSAGES.USER_CREATED)
        )
        onOpenChange(false)
        triggerRefresh()
      } else {
        toast.error(
          result.message ||
            (isUpdate
              ? t(ERROR_MESSAGES.UPDATE_FAILED)
              : t(ERROR_MESSAGES.CREATE_FAILED))
        )
      }
    } catch (_error) {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  const refreshUserData = async () => {
    if (!currentRow) return
    const result = await getUser(currentRow.id)
    if (result.success && result.data) {
      form.reset(transformUserToFormDefaults(result.data))
    }
    triggerRefresh()
  }

  const updateInvoiceField = (
    field: keyof UserInvoiceProfile,
    value: string
  ) => {
    setInvoiceProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSaveInvoiceProfile = async () => {
    if (!currentRow) return

    const normalized = normalizeInvoiceProfile(invoiceProfile)
    const validationError = getInvoiceProfileValidationError(normalized)
    if (validationError) {
      toast.error(t(validationError))
      return
    }

    setInvoiceSaving(true)
    try {
      const result = await updateUserInvoiceProfile(currentRow.id, normalized)
      if (result.success && result.data) {
        setInvoiceProfile({
          ...EMPTY_INVOICE_PROFILE,
          ...result.data,
        })
        toast.success(t('Invoice profile saved'))
      } else {
        toast.error(
          result.message
            ? t(result.message)
            : t('Failed to save invoice profile')
        )
      }
    } catch (_error) {
      toast.error(t('Failed to save invoice profile'))
    } finally {
      setInvoiceSaving(false)
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v)
          if (!v) {
            form.reset()
          }
        }}
      >
        <SheetContent
          className={sideDrawerContentClassName('sm:max-w-[600px]')}
        >
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>
              {isUpdate ? t('Update') : t('Create')} {t('User')}
            </SheetTitle>
            <SheetDescription>
              {isUpdate
                ? t('Update the user by providing necessary info.')
                : t('Add a new user by providing necessary info.')}
            </SheetDescription>
          </SheetHeader>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className={sideDrawerFormClassName()}
            >
              {/* Basic Information */}
              <SideDrawerSection>
                <h3 className='text-sm font-medium'>
                  {t('Basic Information')}
                </h3>

                <FormField
                  control={form.control}
                  name='username'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Username')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('Enter username')}
                          disabled={isUpdate}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isUpdate && (
                  <FormField
                    control={form.control}
                    name='role'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Role')}</FormLabel>
                        <Select
                          items={[
                            { value: '1', label: t('Common User') },
                            { value: '10', label: t('Admin') },
                          ]}
                          onValueChange={(value) =>
                            value !== null && field.onChange(parseInt(value))
                          }
                          value={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('Select a role')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent alignItemWithTrigger={false}>
                            <SelectGroup>
                              <SelectItem value='1'>
                                {t('Common User')}
                              </SelectItem>
                              <SelectItem value='10'>{t('Admin')}</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {t("Set the user's role (cannot be Root)")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='display_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Display Name')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('Enter display name')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Leave empty to use username')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Password')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='password'
                          placeholder={
                            isUpdate
                              ? t('Leave empty to keep unchanged')
                              : t('Enter password (min 8 characters)')
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SideDrawerSection>

              {/* Group & Quota Settings (Update only) */}
              {isUpdate && (
                <SideDrawerSection>
                  <h3 className='text-sm font-medium'>{t('Group & Quota')}</h3>

                  <FormField
                    control={form.control}
                    name='group'
                    render={({ field }) => {
                      // Ensure the user's current group stays visible even if it
                      // is not part of the configured user-usable groups.
                      const groupOptions =
                        field.value && !groups.includes(field.value)
                          ? [...groups, field.value]
                          : groups
                      return (
                      <FormItem>
                        <FormLabel>{t('Group')}</FormLabel>
                        <Select
                          items={[
                            ...groupOptions.map((group) => ({
                              value: group,
                              label: group,
                            })),
                          ]}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('Select a group')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent alignItemWithTrigger={false}>
                            <SelectGroup>
                              {groupOptions.map((group) => (
                                <SelectItem key={group} value={group}>
                                  {group}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                      )
                    }}
                  />

                  <FormField
                    control={form.control}
                    name='quota_dollars'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Remaining Quota ({{currency}})', {
                            currency: currencyLabel,
                          })}
                        </FormLabel>
                        <div className='flex gap-2'>
                          <FormControl>
                            <Input
                              value={
                                tokensOnly
                                  ? String(field.value || 0)
                                  : (field.value || 0).toFixed(6)
                              }
                              readOnly
                              className='flex-1'
                            />
                          </FormControl>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() => setQuotaDialogOpen(true)}
                          >
                            <Pencil className='mr-1 h-4 w-4' />
                            {t('Adjust Quota')}
                          </Button>
                        </div>
                        <FormDescription>
                          {formatQuota(parseQuotaFromDollars(field.value || 0))}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='remark'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Remark')}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t(
                              'Admin notes (only visible to admins)'
                            )}
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SideDrawerSection>
              )}

              {isUpdate && (
                <SideDrawerSection>
                  <div className='flex items-center justify-between gap-2'>
                    <h3 className='text-sm font-medium'>
                      {t('Invoice Profile')}
                    </h3>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={handleSaveInvoiceProfile}
                      disabled={invoiceSaving}
                    >
                      {invoiceSaving ? t('Saving...') : t('Save invoice')}
                    </Button>
                  </div>

                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div className='space-y-1.5'>
                      <Label htmlFor='admin-invoice-company'>
                        {t('Company name')}
                      </Label>
                      <Input
                        id='admin-invoice-company'
                        value={invoiceProfile.company_name}
                        onChange={(event) =>
                          updateInvoiceField('company_name', event.target.value)
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label htmlFor='admin-invoice-email'>
                        {t('Billing email')}
                      </Label>
                      <Input
                        id='admin-invoice-email'
                        type='email'
                        value={invoiceProfile.billing_email}
                        onChange={(event) =>
                          updateInvoiceField(
                            'billing_email',
                            event.target.value
                          )
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label htmlFor='admin-invoice-country'>
                        {t('Country')}
                      </Label>
                      <Input
                        id='admin-invoice-country'
                        value={invoiceProfile.country}
                        onChange={(event) =>
                          updateInvoiceField('country', event.target.value)
                        }
                        placeholder='US'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label htmlFor='admin-invoice-tax-id'>
                        {t('Tax ID')}
                      </Label>
                      <Input
                        id='admin-invoice-tax-id'
                        value={invoiceProfile.tax_id || ''}
                        onChange={(event) =>
                          updateInvoiceField('tax_id', event.target.value)
                        }
                      />
                    </div>
                    <div className='space-y-1.5 sm:col-span-2'>
                      <Label htmlFor='admin-invoice-address'>
                        {t('Address')}
                      </Label>
                      <Input
                        id='admin-invoice-address'
                        value={invoiceProfile.address_line1}
                        onChange={(event) =>
                          updateInvoiceField(
                            'address_line1',
                            event.target.value
                          )
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label htmlFor='admin-invoice-city'>{t('City')}</Label>
                      <Input
                        id='admin-invoice-city'
                        value={invoiceProfile.city || ''}
                        onChange={(event) =>
                          updateInvoiceField('city', event.target.value)
                        }
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label htmlFor='admin-invoice-postal-code'>
                        {t('Postal code')}
                      </Label>
                      <Input
                        id='admin-invoice-postal-code'
                        value={invoiceProfile.postal_code || ''}
                        onChange={(event) =>
                          updateInvoiceField('postal_code', event.target.value)
                        }
                      />
                    </div>
                  </div>
                </SideDrawerSection>
              )}

              {/* Binding Information (Read-only) */}
              {isUpdate && (
                <SideDrawerSection>
                  <h3 className='text-sm font-medium'>
                    {t('Binding Information')}
                  </h3>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Third-party account bindings (read-only, managed by user in profile settings)'
                    )}
                  </p>

                  <div className='flex flex-col gap-3'>
                    {BINDING_FIELDS.map(({ key, label }) => (
                      <div key={key}>
                        <Label className='text-muted-foreground text-xs'>
                          {t(label)}
                        </Label>
                        <Input
                          value={
                            (currentRow?.[key as keyof User] as string) || '-'
                          }
                          disabled
                          className='mt-1'
                        />
                      </div>
                    ))}
                  </div>
                </SideDrawerSection>
              )}
            </form>
          </Form>
          <SheetFooter className={sideDrawerFooterClassName()}>
            <SheetClose render={<Button variant='outline' />}>
              {t('Close')}
            </SheetClose>
            <Button form='user-form' type='submit' disabled={isSubmitting}>
              {isSubmitting ? t('Saving...') : t('Save changes')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Adjust Quota Dialog */}
      {currentRow && (
        <UserQuotaDialog
          open={quotaDialogOpen}
          onOpenChange={setQuotaDialogOpen}
          userId={currentRow.id}
          currentQuota={parseQuotaFromDollars(currentQuotaRaw || 0)}
          onSuccess={refreshUserData}
        />
      )}
    </>
  )
}
