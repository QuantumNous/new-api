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
import { Boxes, Calculator, GitBranch, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OperationalMetricCard } from '@/components/operational-metric-card'
import type { ModelsSectionId } from '../section-registry'

interface ModelsCommandStripProps {
  activeSection: ModelsSectionId
}

export function ModelsCommandStrip(props: ModelsCommandStripProps) {
  const { t } = useTranslation()
  const isDeployments = props.activeSection === 'deployments'

  return (
    <section className='grid gap-3 md:grid-cols-4'>
      <OperationalMetricCard
        label={t('Model surface')}
        value={isDeployments ? t('Deployments') : t('Metadata')}
        description={t('Keep model names, categories, and deployment state scan-friendly.')}
        icon={<Boxes className='size-4' aria-hidden='true' />}
        tone='info'
      />
      <OperationalMetricCard
        label={t('Billing rules')}
        value={t('Visible')}
        description={t('Pricing, quota, and expression-driven rates stay close to model context.')}
        icon={<Calculator className='size-4' aria-hidden='true' />}
        tone='warning'
      />
      <OperationalMetricCard
        label={t('Route coverage')}
        value={t('Mapped')}
        description={t('Use metadata and deployment views to understand provider coverage.')}
        icon={<GitBranch className='size-4' aria-hidden='true' />}
        tone='success'
      />
      <OperationalMetricCard
        label={t('Launch control')}
        value={isDeployments ? t('Active') : t('Ready')}
        description={t('Create deployments or tune metadata without losing the table surface.')}
        icon={<Rocket className='size-4' aria-hidden='true' />}
        tone='neutral'
      />
    </section>
  )
}
