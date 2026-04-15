import * as z from 'zod'
import { redirect } from '@tanstack/react-router'

/**
 * Create search schema for settings routes with section parameter
 */
export function createSectionSearchSchema<TSectionId extends string>(
  sectionIds: readonly [TSectionId, ...TSectionId[]],
  defaultSection: TSectionId
) {
  return z.object({
    section: z
      .enum(sectionIds as unknown as [string, ...string[]])
      .optional()
      .catch(defaultSection),
  })
}

/**
 * Configuration for creating a settings route config
 */
export type SettingsRouteConfigOptions<
  TSectionId extends string,
  TComponent = unknown,
> = {
  /** Section IDs array from section-registry */
  sectionIds: readonly [TSectionId, ...TSectionId[]]
  /** Default section ID */
  defaultSection: TSectionId
  /** Settings component to render */
  component: TComponent
  /** Route path for redirect (e.g., '/system-settings/general') */
  routePath: string
  /** Whether to redirect to default section if no section is provided (default: false) */
  redirectToDefault?: boolean
}

/**
 * Create a settings route configuration with common setup
 * This abstracts the repetitive pattern of:
 * - Creating search schema
 * - Setting up validateSearch
 * - Optionally redirecting to default section
 *
 * @example
 * ```tsx
 * export const Route = createFileRoute('/_authenticated/system-settings/general')(
 *   createSettingsRouteConfig({
 *     sectionIds: GENERAL_SECTION_IDS,
 *     defaultSection: GENERAL_DEFAULT_SECTION,
 *     component: GeneralSettings,
 *     routePath: '/system-settings/general',
 *     redirectToDefault: true,
 *   })
 * )
 * ```
 */
export function createSettingsRouteConfig<
  TSectionId extends string,
  TComponent = unknown,
>(options: SettingsRouteConfigOptions<TSectionId, TComponent>) {
  const {
    sectionIds,
    defaultSection,
    component,
    routePath,
    redirectToDefault = false,
  } = options

  const searchSchema = createSectionSearchSchema(sectionIds, defaultSection)

  const routeConfig = {
    validateSearch: searchSchema,
    component,
    ...(redirectToDefault && {
      beforeLoad: ({
        search,
      }: {
        search?: { section?: TSectionId | string }
      }) => {
        if (!search?.section) {
          throw redirect({
            to: routePath,
            search: { section: defaultSection } as Record<string, unknown>,
          })
        }
      },
    }),
  }

  return routeConfig
}
