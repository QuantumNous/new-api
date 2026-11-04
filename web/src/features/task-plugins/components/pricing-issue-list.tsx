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

import {
  PRICING_ISSUE_REASONS,
  type ModelPricingIssue,
} from '@/features/system-settings/models/pricing-issues'

/** A plugin reports one issue per model; a long catalog stays readable. */
const VISIBLE_ISSUES = 5

type PricingIssueListProps = {
  issues: ModelPricingIssue[]
}

/** The models whose price a plugin change left without a usable price. */
export function PricingIssueList(props: PricingIssueListProps) {
  const { t } = useTranslation()
  const hidden = props.issues.length - VISIBLE_ISSUES
  return (
    <div className='flex flex-col gap-0.5'>
      <p>{t('Prices of these models need attention:')}</p>
      <ul>
        {props.issues.slice(0, VISIBLE_ISSUES).map((issue) => (
          <li key={`${issue.model_name}:${issue.plugin_key}`}>
            {t('{{name}}: {{reason}}', {
              name: issue.model_name,
              reason: t(PRICING_ISSUE_REASONS[issue.reason]),
            })}
          </li>
        ))}
      </ul>
      {hidden > 0 && <p>{t('And {{count}} more models', { count: hidden })}</p>}
    </div>
  )
}
