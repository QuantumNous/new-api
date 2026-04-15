/**
 * Reusable components for filter dialogs
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ============================================================================
// Filter Input Component
// ============================================================================

interface FilterInputProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function FilterInput({
  id,
  label,
  placeholder,
  value,
  onChange,
}: FilterInputProps) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// ============================================================================
// Section Divider Component
// ============================================================================

interface SectionDividerProps {
  label: string
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className='relative'>
      <div className='absolute inset-0 flex items-center'>
        <span className='w-full border-t' />
      </div>
      <div className='relative flex justify-center text-xs uppercase'>
        <span className='bg-background text-muted-foreground px-2'>
          {label}
        </span>
      </div>
    </div>
  )
}
