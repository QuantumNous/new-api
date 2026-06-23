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
import fs from 'node:fs'

const checks = [
  {
    name: 'Super Admin route guard redirects non-root users',
    file: 'src/routes/_authenticated/skills/admin/index.tsx',
    mustContain: [
      "createFileRoute('/_authenticated/skills/admin/')",
      'ROLE.SUPER_ADMIN',
      "to: '/403'",
      'status:',
      'required_plan:',
      'kids_approval_status:',
    ],
  },
  {
    name: 'Admin list API uses the DR-45 endpoint',
    file: 'src/features/admin-skills/api.ts',
    mustContain: ["'/api/v1/admin/skills'", 'params'],
  },
  {
    name: 'Table forwards status, plan, and kids filters as DR-45 query params',
    file: 'src/features/admin-skills/components/admin-skills-table.tsx',
    mustContain: [
      'status,',
      'required_plan: requiredPlan',
      'kids_approval_status: kidsApprovalStatus',
      "searchKey: 'status'",
      "searchKey: 'required_plan'",
      "searchKey: 'kids_approval_status'",
    ],
  },
  {
    name: 'Desktop actions expose edit, preview, lifecycle, and audit entries',
    file: 'src/features/admin-skills/components/admin-skill-row-actions.tsx',
    mustContain: [
      "t('Edit Skill')",
      "t('Preview Skill')",
      "t('Publish')",
      "t('Deprecate')",
      "t('Archive')",
      "t('Audit')",
    ],
  },
  {
    name: 'Mobile list is read-only and exposes preview only',
    file: 'src/features/admin-skills/components/admin-skills-mobile-list.tsx',
    mustContain: ['onPreview', "t('Preview Skill')"],
    mustNotContain: [
      "t('Edit Skill')",
      "t('Publish')",
      "t('Deprecate')",
      "t('Archive')",
      "t('Audit')",
    ],
  },
]

let failed = false

for (const check of checks) {
  const text = fs.readFileSync(check.file, 'utf8')
  const missing = check.mustContain.filter((needle) => !text.includes(needle))
  const forbidden = (check.mustNotContain ?? []).filter((needle) =>
    text.includes(needle)
  )

  if (missing.length > 0 || forbidden.length > 0) {
    failed = true
    console.error(`FAIL ${check.name}`)
    if (missing.length > 0) {
      console.error(`  missing: ${missing.join(', ')}`)
    }
    if (forbidden.length > 0) {
      console.error(`  forbidden present: ${forbidden.join(', ')}`)
    }
  } else {
    console.log(`PASS ${check.name}`)
  }
}

if (failed) {
  process.exitCode = 1
}
