import { useMemo } from 'react'
import { Accordion } from '@/components/ui/accordion'
import { useAccordionState } from '../hooks/use-accordion-state'
import { getOptionValue, useSystemOptions } from '../hooks/use-system-options'
import type { RequestLimitsSettings } from '../types'
import { RateLimitSection } from './rate-limit-section'
import { SensitiveWordsSection } from './sensitive-words-section'
import { SSRFSection } from './ssrf-section'

const defaultRequestLimitsSettings: RequestLimitsSettings = {
  ModelRequestRateLimitEnabled: false,
  ModelRequestRateLimitCount: 0,
  ModelRequestRateLimitSuccessCount: 1000,
  ModelRequestRateLimitDurationMinutes: 1,
  ModelRequestRateLimitGroup: '',
  CheckSensitiveEnabled: false,
  CheckSensitiveOnPromptEnabled: false,
  SensitiveWords: '',
  'fetch_setting.enable_ssrf_protection': true,
  'fetch_setting.allow_private_ip': false,
  'fetch_setting.domain_filter_mode': false,
  'fetch_setting.ip_filter_mode': false,
  'fetch_setting.domain_list': [],
  'fetch_setting.ip_list': [],
  'fetch_setting.allowed_ports': [],
  'fetch_setting.apply_ip_filter_for_domain': false,
}

export function RequestLimitsSettings() {
  const { data, isLoading } = useSystemOptions()
  const { openItems, handleAccordionChange } =
    useAccordionState('request-limits')

  const settings = useMemo(() => {
    return getOptionValue(data?.data, defaultRequestLimitsSettings)
  }, [data?.data])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground'>
          Loading request limits settings...
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <Accordion
          type='multiple'
          value={openItems}
          onValueChange={handleAccordionChange}
          className='space-y-2'
        >
          <RateLimitSection
            defaultValues={{
              ModelRequestRateLimitEnabled:
                settings.ModelRequestRateLimitEnabled,
              ModelRequestRateLimitCount: settings.ModelRequestRateLimitCount,
              ModelRequestRateLimitSuccessCount:
                settings.ModelRequestRateLimitSuccessCount,
              ModelRequestRateLimitDurationMinutes:
                settings.ModelRequestRateLimitDurationMinutes,
              ModelRequestRateLimitGroup: settings.ModelRequestRateLimitGroup,
            }}
          />

          <SensitiveWordsSection
            defaultValues={{
              CheckSensitiveEnabled: settings.CheckSensitiveEnabled,
              CheckSensitiveOnPromptEnabled:
                settings.CheckSensitiveOnPromptEnabled,
              SensitiveWords: settings.SensitiveWords,
            }}
          />

          <SSRFSection
            defaultValues={{
              'fetch_setting.enable_ssrf_protection':
                settings['fetch_setting.enable_ssrf_protection'],
              'fetch_setting.allow_private_ip':
                settings['fetch_setting.allow_private_ip'],
              'fetch_setting.domain_filter_mode':
                settings['fetch_setting.domain_filter_mode'],
              'fetch_setting.ip_filter_mode':
                settings['fetch_setting.ip_filter_mode'],
              'fetch_setting.domain_list':
                settings['fetch_setting.domain_list'],
              'fetch_setting.ip_list': settings['fetch_setting.ip_list'],
              'fetch_setting.allowed_ports':
                settings['fetch_setting.allowed_ports'],
              'fetch_setting.apply_ip_filter_for_domain':
                settings['fetch_setting.apply_ip_filter_for_domain'],
            }}
          />
        </Accordion>
      </div>
    </div>
  )
}
