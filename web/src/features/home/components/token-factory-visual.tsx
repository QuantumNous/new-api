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
import {
  ArrowDown,
  ArrowUpRight,
  Box,
  Cpu,
  Layers3,
  Network,
  Workflow,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function TokenFactoryVisual() {
  const { t } = useTranslation()

  return (
    <div
      className='ti-factory'
      role='img'
      aria-label={t(
        'Compute flows through TokenInfra to power AI applications'
      )}
    >
      <div className='ti-diagram-heading' aria-hidden='true'>
        <span>TokenInfra / {t('Token Factory')}</span>
        <span className='ti-diagram-label'>01 — 03</span>
      </div>
      <div className='ti-factory-inputs' aria-hidden='true'>
        <span>
          <Cpu size={16} /> GPU
        </span>
        <span>
          <Network size={16} /> {t('Cloud')}
        </span>
        <span>
          <Layers3 size={16} /> {t('Models')}
        </span>
      </div>
      <div className='ti-input-lines' aria-hidden='true'>
        <i />
        <i />
        <i />
      </div>
      <div className='ti-factory-engine' aria-hidden='true'>
        <div className='ti-engine-top'>
          <Box strokeWidth={1} size={38} />
          <span>TokenInfra</span>
          <ArrowUpRight size={18} />
        </div>
        <div className='ti-engine-body'>
          <span>{t('Unified access')}</span>
          <span>{t('Intelligent routing')}</span>
          <span>{t('On-demand delivery')}</span>
        </div>
        <div className='ti-engine-base'>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className='ti-token-stream' aria-hidden='true'>
        <i />
        <i />
        <i />
        <ArrowDown size={18} />
      </div>
      <div className='ti-factory-output' aria-hidden='true'>
        <Workflow size={20} />
        <span>{t('AI applications')}</span>
        <span>API / SDK / CLI</span>
      </div>
      <div className='ti-diagram-caption' aria-hidden='true'>
        <span className='ti-status-dot' />
        {t('From compute to useful tokens')}
      </div>
    </div>
  )
}
