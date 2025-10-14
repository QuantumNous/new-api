import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

type PricingControlsProps = {
  currency: 'USD' | 'CNY'
  onCurrencyChange: (value: 'USD' | 'CNY') => void
  tokenUnit: 'M' | 'K'
  onTokenUnitChange: (value: 'M' | 'K') => void
  showWithRecharge: boolean
  onShowWithRechargeChange: (value: boolean) => void
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

export function PricingControls({
  currency,
  onCurrencyChange,
  tokenUnit,
  onTokenUnitChange,
  showWithRecharge,
  onShowWithRechargeChange,
  orientation = 'horizontal',
  className,
}: PricingControlsProps) {
  const isVertical = orientation === 'vertical'

  return (
    <div
      className={cn(
        isVertical
          ? 'flex flex-col gap-6'
          : 'flex flex-wrap items-center gap-4',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          isVertical && 'flex-col items-start'
        )}
      >
        <Label htmlFor='currency'>Currency</Label>
        <Select value={currency} onValueChange={onCurrencyChange}>
          <SelectTrigger
            id='currency'
            className={cn(isVertical ? 'w-full' : 'w-[100px]')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='USD'>USD</SelectItem>
            <SelectItem value='CNY'>CNY</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          'flex items-center gap-2',
          isVertical && 'flex-col items-start'
        )}
      >
        <Label htmlFor='token-unit'>Token Unit</Label>
        <Select value={tokenUnit} onValueChange={onTokenUnitChange}>
          <SelectTrigger
            id='token-unit'
            className={cn(isVertical ? 'w-full' : 'w-[120px]')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='M'>Million (M)</SelectItem>
            <SelectItem value='K'>Thousand (K)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          'flex items-center gap-2',
          isVertical && 'justify-between'
        )}
      >
        <Switch
          id='recharge'
          checked={showWithRecharge}
          onCheckedChange={onShowWithRechargeChange}
        />
        <Label htmlFor='recharge'>Show Recharge Price</Label>
      </div>
    </div>
  )
}
