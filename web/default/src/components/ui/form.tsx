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
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form'
import { useRender } from '@base-ui/react/use-render'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

function isErrorLeaf(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return 'message' in record || 'type' in record || 'ref' in record
}

function getFirstErrorFieldName(
  errors: FieldErrors<FieldValues>,
  parentPath = ''
): string | undefined {
  for (const [key, value] of Object.entries(errors)) {
    const path = parentPath ? `${parentPath}.${key}` : key

    if (isErrorLeaf(value)) {
      return path
    }

    if (value && typeof value === 'object') {
      const nested = getFirstErrorFieldName(
        value as FieldErrors<FieldValues>,
        path
      )
      if (nested) return nested
    }
  }

  return undefined
}

function getElementByFieldName(name: string): HTMLElement | null {
  const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return document.querySelector<HTMLElement>(`[name="${escapedName}"]`)
}

function Form<TFieldValues extends FieldValues>({
  children,
  ...props
}: React.PropsWithChildren<UseFormReturn<TFieldValues>>) {
  const {
    formState: { errors, submitCount },
    setFocus,
  } = props

  React.useEffect(() => {
    if (submitCount === 0) return

    const firstErrorName = getFirstErrorFieldName(
      errors as FieldErrors<FieldValues>
    )
    if (!firstErrorName) return

    window.requestAnimationFrame(() => {
      setFocus(firstErrorName as FieldPath<TFieldValues>)

      const element = getElementByFieldName(firstErrorName)
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [errors, setFocus, submitCount])

  return <FormProvider {...props}>{children}</FormProvider>
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>')
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot='form-item'
        className={cn('grid gap-2', className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot='form-label'
      data-error={!!error}
      className={cn('data-[error=true]:text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({
  children,
  ...props
}: { children: React.ReactElement } & Record<string, unknown>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return useRender({
    render: children,
    props: {
      'data-slot': 'form-control',
      id: formItemId,
      'aria-describedby': !error
        ? `${formDescriptionId}`
        : `${formDescriptionId} ${formMessageId}`,
      'aria-invalid': !!error,
      ...props,
    },
  })
}

function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot='form-description'
      id={formDescriptionId}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField()
  const { t } = useTranslation()
  const body = error ? String(error?.message ?? '') : props.children

  if (!body) {
    return null
  }

  const translatedBody = typeof body === 'string' ? t(body) : body

  return (
    <p
      data-slot='form-message'
      id={formMessageId}
      className={cn('text-destructive text-sm', className)}
      {...props}
    >
      {translatedBody}
    </p>
  )
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
