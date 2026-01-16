import * as z from 'zod'
import type { RouteConfig } from '@tanstack/react-router'

/**
 * Create search schema for settings routes with section parameter
 */
export function createSectionSearchSchema<TSectionId extends string>(
  sectionIds: readonly [TSectionId, ...TSectionId[]],
  defaultSection: TSectionId
) {
  return z.object({
    section: z.enum(sectionIds as [string, ...string[]]).optional().catch(defaultSection),
  })
}
