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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Check, Info, Rocket, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { COMPUTE_MODELS, GPU_OPTIONS, type ComputeModel, type GpuOption } from '../catalog'
import { useComputeBalance } from '../use-compute-balance'
import { LowBalanceNotice } from './balance-bar'
import { EndpointPanel } from './endpoint-panel'
import { GpuPicker } from './gpu-picker'
import { ModelPicker } from './model-picker'

type Step = 1 | 2 | 3

function Stepper(props: { step: Step }) {
  const { t } = useTranslation()
  const steps = [
    { n: 1 as const, label: t('Pick a model') },
    { n: 2 as const, label: t('Pick a GPU') },
    { n: 3 as const, label: t('Deployed') },
  ]
  return (
    <div className='flex items-center gap-2'>
      {steps.map((s, i) => {
        const done = props.step > s.n
        const active = props.step === s.n
        return (
          <div key={s.n} className='flex items-center gap-2'>
            <div
              className={cn(
                'flex items-center gap-2 text-sm font-medium',
                active || done ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                  done || active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {done ? <Check className='size-3.5' /> : s.n}
              </span>
              <span className='hidden sm:inline'>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'h-px w-8 sm:w-12',
                  done ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Hint(props: { children: React.ReactNode; variant?: 'info' | 'warning' }) {
  const warning = props.variant === 'warning'
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border p-3 text-xs',
        warning
          ? 'bg-warning/10 border-warning/30 text-warning-foreground'
          : 'bg-primary/5 border-primary/20 text-foreground'
      )}
    >
      <Info className={cn('mt-0.5 size-4 shrink-0', warning ? 'text-warning' : 'text-primary')} />
      <div>{props.children}</div>
    </div>
  )
}

export function DeployWizard() {
  const { t } = useTranslation()
  const { isEmpty } = useComputeBalance()
  const [step, setStep] = useState<Step>(1)
  const [model, setModel] = useState<ComputeModel>(
    COMPUTE_MODELS.find((m) => m.recommended) ?? COMPUTE_MODELS[0]
  )
  const [gpu, setGpu] = useState<GpuOption>(
    GPU_OPTIONS.find((g) => g.recommended) ?? GPU_OPTIONS[0]
  )

  return (
    <div className='flex flex-col gap-6'>
      <LowBalanceNotice />
      <Stepper step={step} />

      {step === 1 && (
        <>
          <ModelPicker
            selected={model}
            onSelect={(m) => setModel(m)}
          />
          <div className='bg-card sticky bottom-0 flex items-center justify-between gap-3 rounded-lg border p-3 shadow-sm'>
            <div className='text-muted-foreground text-sm'>
              {t('Selected')}: <span className='text-foreground font-semibold'>{model.name}</span>
            </div>
            <Button onClick={() => setStep(2)}>{t('Next: pick a GPU')}</Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Hint>
            {t(
              'Not sure? RTX 4090 runs this model comfortably and costs the least. Serverless scales to zero when idle, so you only pay for what you use.'
            )}
          </Hint>
          <GpuPicker selected={gpu} onSelect={(g) => setGpu(g)} />
          <Hint variant='warning'>
            {t(
              'Illustrative pricing, pending calibration. Final rate is set from real upstream cost plus a thin margin.'
            )}
          </Hint>
          <div className='bg-card sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 shadow-sm'>
            <div className='text-muted-foreground text-sm'>
              {model.name} · <span className='text-foreground font-semibold'>{gpu.name}</span> ·{' '}
              <span className='text-primary font-semibold'>
                {gpu.price} {t(gpu.priceUnitKey)}
              </span>
              , {t('idle')} $0
            </div>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={() => setStep(1)}>
                {t('Back')}
              </Button>
              {isEmpty ? (
                <Button render={<Link to='/wallet' />}>
                  <Wallet className='size-4' />
                  {t('Top up to deploy')}
                </Button>
              ) : (
                <Button onClick={() => setStep(3)}>
                  <Rocket className='size-4' />
                  {t('Deploy')}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <EndpointPanel model={model} />
          <div className='flex justify-end'>
            <Button
              variant='outline'
              onClick={() => {
                setStep(1)
              }}
            >
              {t('Deploy another')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
