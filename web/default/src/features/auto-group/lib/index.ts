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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import {
  ERROR_MESSAGES,
  RULE_VALIDATION,
} from '../constants'
import type { AutoGroupRule, RuleFormData } from '../types'

// ============================================================================
// Form Schema (use getRuleFormSchema(t) in components for i18n messages)
// ============================================================================

export function getRuleFormSchema(t: TFunction) {
  return z.object({
    job_title: z
      .string()
      .min(RULE_VALIDATION.JOB_TITLE_MIN_LENGTH, t(ERROR_MESSAGES.JOB_TITLE_LENGTH_INVALID, {
        min: RULE_VALIDATION.JOB_TITLE_MIN_LENGTH,
        max: RULE_VALIDATION.JOB_TITLE_MAX_LENGTH,
      }))
      .max(RULE_VALIDATION.JOB_TITLE_MAX_LENGTH, t(ERROR_MESSAGES.JOB_TITLE_LENGTH_INVALID, {
        min: RULE_VALIDATION.JOB_TITLE_MIN_LENGTH,
        max: RULE_VALIDATION.JOB_TITLE_MAX_LENGTH,
      })),
    target_group: z
      .string()
      .min(1, t(ERROR_MESSAGES.TARGET_GROUP_REQUIRED)),
    enabled: z.boolean(),
    priority: z
      .number()
      .min(RULE_VALIDATION.PRIORITY_MIN)
      .max(RULE_VALIDATION.PRIORITY_MAX),
    remark: z
      .string()
      .max(RULE_VALIDATION.REMARK_MAX_LENGTH)
      .optional()
      .or(z.literal('')),
  })
}

export type RuleFormValues = z.infer<ReturnType<typeof getRuleFormSchema>>

// ============================================================================
// Form Defaults
// ============================================================================

export const RULE_FORM_DEFAULT_VALUES: RuleFormValues = {
  job_title: '',
  target_group: '',
  enabled: true,
  priority: 0,
  remark: '',
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform validated form values to the API payload.
 */
export function transformFormValuesToPayload(
  data: RuleFormValues
): RuleFormData {
  return {
    job_title: data.job_title.trim(),
    target_group: data.target_group,
    enabled: data.enabled,
    priority: data.priority,
    remark: data.remark?.trim() || undefined,
  }
}

/**
 * Transform an existing rule to form default values (for edit mode).
 */
export function transformRuleToFormValues(
  rule: AutoGroupRule
): RuleFormValues {
  return {
    job_title: rule.job_title,
    target_group: rule.target_group,
    enabled: rule.enabled,
    priority: rule.priority,
    remark: rule.remark ?? '',
  }
}
