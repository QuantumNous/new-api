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
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { RichContent } from '@/components/rich-content'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { isSafeCustomNavUrl } from '@/features/system-settings/maintenance/custom-nav-config'
import { useCustomNavItems } from '@/hooks/use-custom-nav-items'

type CustomNavPageProps = {
  navId: string
}

export function CustomNavPage(props: CustomNavPageProps) {
  const { t } = useTranslation()
  const items = useCustomNavItems()
  const item = items.find((candidate) => candidate.id === props.navId)

  if (!item) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Not Found')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Alert variant='destructive'>
            <AlertDescription>
              {t('This page is not available.')}
            </AlertDescription>
          </Alert>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout fixedContent={item.contentType === 'url'}>
      <SectionPageLayout.Title>{item.label}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <CustomNavContent
          contentType={item.contentType}
          content={item.content}
          title={item.label}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

type CustomNavContentProps = {
  contentType: 'html' | 'markdown' | 'url'
  content: string
  title: string
}

function CustomNavContent(props: CustomNavContentProps) {
  const { t } = useTranslation()

  if (props.contentType === 'url') {
    if (!isSafeCustomNavUrl(props.content)) {
      return (
        <Alert variant='destructive'>
          <AlertDescription>{t('Enter a valid http(s) URL.')}</AlertDescription>
        </Alert>
      )
    }

    return (
      <iframe
        src={props.content.trim()}
        title={props.title}
        className='h-full min-h-[500px] w-full rounded-lg border'
        referrerPolicy='no-referrer'
        sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts'
      />
    )
  }

  return (
    <RichContent
      content={props.content}
      mode={props.contentType === 'html' ? 'html' : 'markdown'}
      htmlVariant='isolated'
      className='max-w-none'
    />
  )
}
