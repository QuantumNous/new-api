import { z } from 'zod'
import type {
  LayoutRoute,
  PhysicalSubtree,
  Route,
  VirtualRootRoute,
} from '@tanstack/virtual-file-routes'

const indexRouteSchema = z.object({
  type: z.literal('index'),
  file: z.string(),
})

const layoutRouteSchema: z.ZodType<LayoutRoute> = z.object({
  type: z.literal('layout'),
  id: z.string().optional(),
  file: z.string(),
  children: z.array(z.lazy(() => virtualRouteNodeSchema)).optional(),
})

const routeSchema: z.ZodType<Route> = z.object({
  type: z.literal('route'),
  file: z.string().optional(),
  path: z.string(),
  children: z.array(z.lazy(() => virtualRouteNodeSchema)).optional(),
})

const physicalSubTreeSchema: z.ZodType<PhysicalSubtree> = z.object({
  type: z.literal('physical'),
  directory: z.string(),
  pathPrefix: z.string(),
})

const virtualRouteNodeSchema = z.union([
  indexRouteSchema,
  layoutRouteSchema,
  routeSchema,
  physicalSubTreeSchema,
])

export const virtualRootRouteSchema: z.ZodType<VirtualRootRoute> = z.object({
  type: z.literal('root'),
  file: z.string(),
  children: z.array(virtualRouteNodeSchema).optional(),
})
