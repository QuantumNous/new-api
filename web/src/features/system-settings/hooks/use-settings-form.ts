import { useRef } from 'react'
import { useForm, type UseFormProps, type FieldValues } from 'react-hook-form'
import { toast } from 'sonner'

type SettingsFormOptions<T extends FieldValues> = UseFormProps<T> & {
  onSubmit: (data: T, changedFields: Partial<T>) => Promise<void>
  compareValues?: (a: any, b: any) => boolean
}

/**
 * Unified hook for system settings forms
 *
 * Key features:
 * - Initializes form with defaultValues only on mount
 * - No automatic resets that could overwrite user input
 * - Tracks changed fields to minimize API calls
 * - Provides manual reset functionality
 *
 * @example
 * ```tsx
 * const { form, handleSubmit, handleReset } = useSettingsForm({
 *   resolver: zodResolver(schema),
 *   defaultValues,
 *   onSubmit: async (data, changed) => {
 *     for (const [key, value] of Object.entries(changed)) {
 *       await updateOption.mutateAsync({ key, value })
 *     }
 *   }
 * })
 * ```
 */
export function useSettingsForm<T extends FieldValues>({
  onSubmit,
  compareValues,
  ...formOptions
}: SettingsFormOptions<T>) {
  const form = useForm<T>(formOptions)

  // Store initial values at mount time - never auto-reset after this
  const mountedDefaultsRef = useRef<T>(formOptions.defaultValues as T)

  const defaultCompare = (a: any, b: any): boolean => {
    if (a === b) return true
    if (typeof a !== typeof b) return false

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      return JSON.stringify(a) === JSON.stringify(b)
    }

    // Handle objects (but not null)
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b)
    }

    return false
  }

  const compare = compareValues || defaultCompare

  const handleSubmit = async (data: T) => {
    // Find only the fields that actually changed
    const changedFields = Object.entries(data).reduce((acc, [key, value]) => {
      const originalValue = mountedDefaultsRef.current[key as keyof T]
      if (!compare(value, originalValue)) {
        acc[key as keyof T] = value
      }
      return acc
    }, {} as Partial<T>)

    if (Object.keys(changedFields).length === 0) {
      toast.info('No changes to save')
      return
    }

    try {
      await onSubmit(data, changedFields)
      // Update mounted defaults after successful save
      mountedDefaultsRef.current = data
      // Reset dirty state
      form.reset(data)
    } catch (error) {
      // Error already handled by mutation
      console.error('Form submission error:', error)
    }
  }

  const handleReset = () => {
    form.reset(mountedDefaultsRef.current)
    toast.success('Form reset to saved values')
  }

  return {
    form,
    handleSubmit: form.handleSubmit(handleSubmit),
    handleReset,
    isDirty: form.formState.isDirty,
    isSubmitting: form.formState.isSubmitting,
  }
}
