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
// Coverage: route guard, DR-45 API params, filter wiring, mobile read-only contract.
import { isRedirect } from '@tanstack/react-router'
import { Route } from '@/routes/_authenticated/skills/admin'
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import {
  createAdminSkill,
  createAdminSkillVersion,
  getAdminSkills,
  listAdminSkillAuditLog,
  listAdminSkillVersions,
  patchAdminSkill,
} from '../api'
import { adminSkillEditorTestUtils } from '../components/admin-skill-editor-dialog'

const authState = vi.hoisted(() => ({
  user: null as { id: number; username: string; role: number } | null,
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async () => ({
      data: {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, has_next: false },
      },
    })),
    patch: vi.fn(async () => ({
      data: { data: { id: 'skill-1' } },
    })),
    post: vi.fn(async () => ({
      data: { data: { id: 'skill-1' } },
    })),
  },
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      auth: {
        user: authState.user,
        setUser: (
          user: { id: number; username: string; role: number } | null
        ) => {
          authState.user = user
        },
        reset: () => {
          authState.user = null
        },
      },
    }),
  },
}))

function setUserRole(role: number | null) {
  authState.user =
    role == null
      ? null
      : {
          id: 1,
          username: 'reviewer',
          role,
        }
}

describe('DR-49 Admin Skills route guard', () => {
  beforeEach(() => {
    setUserRole(null)
  })

  it('allows Super Admin to enter /skills/admin', () => {
    setUserRole(ROLE.SUPER_ADMIN)

    expect(() => Route.options.beforeLoad?.({} as never)).not.toThrow()
  })

  it('redirects non-Super Admin users to /403', () => {
    setUserRole(ROLE.ADMIN)

    let caught: unknown
    try {
      Route.options.beforeLoad?.({} as never)
    } catch (error) {
      caught = error
    }

    expect(isRedirect(caught)).toBe(true)
    expect((caught as { options: { to: string } }).options.to).toBe('/403')
  })
})

describe('DR-49 Admin Skills API/filter contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards status, required_plan, and kids_approval_status to DR-45', async () => {
    const params = {
      page: 2,
      limit: 50,
      status: 'published' as const,
      required_plan: 'pro' as const,
      kids_approval_status: 'approved' as const,
    }

    await getAdminSkills(params)

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/admin/skills',
      expect.objectContaining({
        params,
        skipErrorHandler: true,
      })
    )
  })

  it('wires DR-50 create, patch, version, and audit API calls', async () => {
    await createAdminSkill({
      slug: 'draft-skill',
      name: 'Draft Skill',
      short_description: 'Short',
      description: 'Long',
      category: 'writing',
      required_plan: 'free',
      monetization_type: 'free',
      max_input_tokens: 2000,
    })
    await patchAdminSkill('skill-1', {
      name: 'Updated Skill',
      max_input_tokens: 2000,
    })
    await createAdminSkillVersion('skill-1', {
      instruction_template: 'Use the provided input.',
      output_schema: { type: 'object' },
      download_instructions: 'Download and extract the package.',
      usage_instructions: 'Run through DeepRouter.',
      prerequisites: ['DeepRouter API key'],
      quickstart: ['Extract the zip'],
      example_io: [{ input: 'brief', output: 'summary' }],
    })
    await listAdminSkillVersions('skill-1')
    await listAdminSkillAuditLog('skill-1')

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/admin/skills',
      expect.objectContaining({ slug: 'draft-skill' }),
      expect.objectContaining({ skipErrorHandler: true })
    )
    expect(api.patch).toHaveBeenCalledWith(
      '/api/v1/admin/skills/skill-1',
      expect.objectContaining({ max_input_tokens: 2000 }),
      expect.objectContaining({ skipErrorHandler: true })
    )
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/admin/skills/skill-1/versions',
      expect.objectContaining({
        instruction_template: 'Use the provided input.',
        download_instructions: 'Download and extract the package.',
        usage_instructions: 'Run through DeepRouter.',
      }),
      expect.objectContaining({ skipErrorHandler: true })
    )
    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/admin/skills/skill-1/versions',
      expect.objectContaining({
        params: { page: 1, limit: 20 },
        skipErrorHandler: true,
      })
    )
    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/admin/skills/skill-1/audit-log',
      expect.objectContaining({
        params: { page: 1, limit: 20 },
        skipErrorHandler: true,
      })
    )
  })

  it('wires the table filters to the DR-45 query parameter names', () => {
    const tableSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skills-table.tsx'
      ),
      'utf8'
    )

    expect(tableSource).toContain("searchKey: 'status'")
    expect(tableSource).toContain("searchKey: 'required_plan'")
    expect(tableSource).toContain("searchKey: 'kids_approval_status'")
    expect(tableSource).toContain('required_plan: requiredPlan')
    expect(tableSource).toContain('kids_approval_status: kidsApprovalStatus')
  })

  it('renders the DR-50 editor entry point and sectioned editor contract', () => {
    const tableSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skills-table.tsx'
      ),
      'utf8'
    )
    const editorSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skill-editor-dialog.tsx'
      ),
      'utf8'
    )

    expect(tableSource).toContain("t('Create Skill Draft')")
    expect(editorSource).toContain("title={t('Metadata')}")
    expect(editorSource).toContain("title={t('User Guidance')}")
    expect(editorSource).toContain("title={t('Entitlement')}")
    expect(editorSource).toContain("title={t('Execution')}")
    expect(editorSource).toContain("label={t('Download Instructions')}")
    expect(editorSource).toContain("label={t('Usage Instructions')}")
    expect(editorSource).toContain("label={t('Prerequisites')}")
    expect(editorSource).toContain("label={t('Quickstart')}")
    expect(editorSource).toContain("label={t('Example I/O')}")
    expect(editorSource).toContain("title={t('Safety')}")
    expect(editorSource).toContain("title={t('Promotion')}")
    expect(editorSource).toContain("title={t('Version History')}")
    expect(editorSource).toContain("title={t('Audit Log')}")
    expect(editorSource).toContain("t('Version change pending')")
    expect(editorSource).toContain('max_input_tokens is required')
    expect(editorSource).toContain('createAdminSkillVersion')
  })

  it('validates DR-50 Free/free-quota max_input_tokens and builds structured payloads', () => {
    const form = {
      ...adminSkillEditorTestUtils.emptyForm(),
      slug: 'draft-skill',
      name: 'Draft Skill',
      short_description: 'Short',
      description: 'Long',
      category: 'writing',
      tags: 'ops\nwriting',
      input_hints: '[{"name":"topic"}]',
      example_inputs: '[{"topic":"contracts"}]',
      example_outputs: '[{"summary":"done"}]',
      required_plan: 'free' as const,
      monetization_type: 'free' as const,
      instruction_template: 'Use the latest brief.',
      download_instructions: 'Download and extract the package.',
      usage_instructions: 'Run through DeepRouter.',
      prerequisites: '["DeepRouter API key"]',
      quickstart: '["Extract the zip"]',
      example_io: '[{"input":"brief","output":"summary"}]',
      model_whitelist: 'smart-tier\nfast-tier',
    }

    const missingTokens = adminSkillEditorTestUtils.parseForm(form, 'create')
    expect(missingTokens.ok).toBe(false)
    expect(missingTokens.errors.max_input_tokens).toContain(
      'max_input_tokens is required'
    )

    const valid = adminSkillEditorTestUtils.parseForm(
      { ...form, max_input_tokens: '2000' },
      'create'
    )
    expect(valid.ok).toBe(true)
    expect(valid.createPayload).toEqual(
      expect.objectContaining({
        slug: 'draft-skill',
        max_input_tokens: 2000,
      })
    )
    expect(valid.patchPayload).toEqual(
      expect.objectContaining({
        tags: ['ops', 'writing'],
        input_hints: [{ name: 'topic' }],
        model_whitelist: ['smart-tier', 'fast-tier'],
      })
    )
    expect(valid.versionPayload).toEqual(
      expect.objectContaining({
        instruction_template: 'Use the latest brief.',
        download_instructions: 'Download and extract the package.',
        usage_instructions: 'Run through DeepRouter.',
        prerequisites: ['DeepRouter API key'],
        quickstart: ['Extract the zip'],
        example_io: [{ input: 'brief', output: 'summary' }],
      })
    )
  })

  it('validates DR-93 version instructions and array fields before save', () => {
    const base = {
      ...adminSkillEditorTestUtils.emptyForm(),
      slug: 'docs-skill',
      name: 'Docs Skill',
      short_description: 'Short',
      description: 'Long',
      category: 'writing',
      required_plan: 'pro' as const,
      monetization_type: 'plan_included' as const,
      instruction_template: 'Use the input.',
      prerequisites: '{"text":"not array"}',
      quickstart: '[]',
      example_io: '[]',
    }

    const invalid = adminSkillEditorTestUtils.parseForm(base, 'create')
    expect(invalid.ok).toBe(false)
    expect(invalid.errors.download_instructions).toContain(
      'Download instructions are required'
    )
    expect(invalid.errors.usage_instructions).toContain(
      'Usage instructions are required'
    )
    expect(invalid.errors.prerequisites).toBe('Enter a valid JSON array.')
  })

  it('validates DR-50 token markup and JSON fields before save', () => {
    const base = {
      ...adminSkillEditorTestUtils.emptyForm(),
      slug: 'markup-skill',
      name: 'Markup Skill',
      short_description: 'Short',
      description: 'Long',
      category: 'writing',
      required_plan: 'pro' as const,
      monetization_type: 'token_markup' as const,
      input_hints: '{bad',
      max_input_tokens: '',
    }

    const invalid = adminSkillEditorTestUtils.parseForm(base, 'create')
    expect(invalid.ok).toBe(false)
    expect(invalid.errors.price_markup).toContain('Markup must be greater')
    expect(invalid.errors.input_hints).toBe('Enter valid JSON.')

    const valid = adminSkillEditorTestUtils.parseForm(
      { ...base, input_hints: '[]', price_markup: '0.2' },
      'create'
    )
    expect(valid.ok).toBe(true)
    expect(valid.createPayload.price_markup).toBe(0.2)
    expect(valid.patchPayload.price_markup).toBe(0.2)
  })

  it('keeps mobile read-only: preview only, no edit or lifecycle actions', () => {
    const mobileSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skills-mobile-list.tsx'
      ),
      'utf8'
    )

    expect(mobileSource).toContain("t('Preview Skill')")
    expect(mobileSource).not.toContain("t('Edit Skill')")
    expect(mobileSource).not.toContain("t('Publish')")
    expect(mobileSource).not.toContain("t('Deprecate')")
    expect(mobileSource).not.toContain("t('Archive')")
    expect(mobileSource).not.toContain("t('Audit')")
  })

  it('shows DR-91 download velocity in desktop and mobile admin skill rows', () => {
    const columnsSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skills-columns.tsx'
      ),
      'utf8'
    )
    const mobileSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'src/features/admin-skills/components/admin-skills-mobile-list.tsx'
      ),
      'utf8'
    )

    expect(columnsSource).toContain('download_velocity')
    expect(columnsSource).toContain('skill.downloads_7d')
    expect(columnsSource).toContain('skill.downloads_30d')
    expect(mobileSource).toContain('skill.downloads_7d')
    expect(mobileSource).toContain('skill.downloads_30d')
  })
})
