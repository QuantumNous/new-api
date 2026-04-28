import type { UseFormReturn } from 'react-hook-form'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDiscoverEndpoints } from '../hooks/use-custom-oauth-mutations'
import type { CustomOAuthFormValues } from '../types'

type DiscoveryButtonProps = {
  form: UseFormReturn<CustomOAuthFormValues>
}

export function DiscoveryButton(props: DiscoveryButtonProps) {
  const { t } = useTranslation()
  const discover = useDiscoverEndpoints()

  const handleDiscover = async () => {
    const wellKnown = props.form.getValues('well_known')
    if (!wellKnown) {
      toast.error(t('Please enter a Well-Known URL first'))
      return
    }

    if (!wellKnown.startsWith('http://') && !wellKnown.startsWith('https://')) {
      toast.error(t('Well-Known URL must start with http:// or https://'))
      return
    }

    const res = await discover.mutateAsync(wellKnown)
    if (res.success && res.data?.discovery) {
      const disc = res.data.discovery
      if (disc.authorization_endpoint) {
        props.form.setValue(
          'authorization_endpoint',
          disc.authorization_endpoint,
          { shouldDirty: true }
        )
      }
      if (disc.token_endpoint) {
        props.form.setValue('token_endpoint', disc.token_endpoint, {
          shouldDirty: true,
        })
      }
      if (disc.userinfo_endpoint) {
        props.form.setValue('user_info_endpoint', disc.userinfo_endpoint, {
          shouldDirty: true,
        })
      }
      if (disc.scopes_supported && disc.scopes_supported.length > 0) {
        const currentScopes = props.form.getValues('scopes')
        if (!currentScopes) {
          const defaultScopes = disc.scopes_supported
            .filter((s) => ['openid', 'profile', 'email'].includes(s))
            .join(' ')
          if (defaultScopes) {
            props.form.setValue('scopes', defaultScopes, {
              shouldDirty: true,
            })
          }
        }
      }
    }
  }

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={handleDiscover}
      disabled={discover.isPending}
    >
      <Search className='mr-1.5 h-3.5 w-3.5' />
      {discover.isPending ? t('Discovering...') : t('Auto-discover')}
    </Button>
  )
}
