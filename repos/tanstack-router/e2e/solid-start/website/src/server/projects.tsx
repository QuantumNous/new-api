import { createServerFn } from '@tanstack/solid-start'
import { notFound } from '@tanstack/solid-router'
import { capitalize } from '~/utils/seo'

const projects = ['router', 'table', 'query', 'form', 'ranger']

export const getProjects = createServerFn({ method: 'GET' }).handler(
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 200))

    return projects
  },
)

export const getProject = createServerFn({ method: 'GET' })
  .validator((project: string) => project)
  .handler(async (ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 200))

    const selectedProject = projects.find((p) => p === ctx.data.toLowerCase())

    if (!selectedProject) {
      throw notFound()
    }

    return {
      id: selectedProject,
      name: capitalize(selectedProject),
      versions: ['latest', 'v2', 'v1'],
      frameworks: ['solid', 'react', 'vue', 'solidjs', 'svelte'],
      examples: ['basic', 'kitchen-sink'],
    }
  })
