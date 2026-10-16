import { format } from './utils'
import type { Config } from './config'

type TemplateTag = 'tsrImports' | 'tsrPath' | 'tsrExportStart' | 'tsrExportEnd'

export function fillTemplate(
  config: Config,
  template: string,
  values: Record<TemplateTag, string>,
) {
  const replaced = template.replace(
    /%%(\w+)%%/g,
    (_, key) => values[key as TemplateTag] || '',
  )
  return format(replaced, config)
}

export type TargetTemplate = {
  fullPkg: string
  subPkg: string
  rootRoute: {
    template: () => string
    imports: {
      tsrImports: () => string
      tsrExportStart: () => string
      tsrExportEnd: () => string
    }
  }
  route: {
    template: () => string
    imports: {
      tsrImports: () => string
      tsrExportStart: (routePath: string) => string
      tsrExportEnd: () => string
    }
  }
  lazyRoute: {
    template: () => string
    imports: {
      tsrImports: () => string
      tsrExportStart: (routePath: string) => string
      tsrExportEnd: () => string
    }
  }
}

function serializeRoutePath(routePath: string) {
  return JSON.stringify(routePath)
}

export function getTargetTemplate(config: Config): TargetTemplate {
  const target = config.target
  switch (target) {
    case 'react':
      return {
        fullPkg: '@tanstack/react-router',
        subPkg: 'react-router',
        rootRoute: {
          template: () =>
            [
              'import * as React from "react"\n',
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RootComponent\n }%%tsrExportEnd%%\n\n',
              'function RootComponent() { return (<React.Fragment><div>Hello "%%tsrPath%%"!</div><Outlet /></React.Fragment>) };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { Outlet, createRootRoute } from '@tanstack/react-router';",
            tsrExportStart: () => 'export const Route = createRootRoute(',
            tsrExportEnd: () => ');',
          },
        },
        route: {
          template: () =>
            [
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
              'function RouteComponent() { return <div>Hello "%%tsrPath%%"!</div> };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { createFileRoute } from '@tanstack/react-router';",
            tsrExportStart: (routePath) =>
              `export const Route = createFileRoute(${serializeRoutePath(routePath)})(`,
            tsrExportEnd: () => ');',
          },
        },
        lazyRoute: {
          template: () =>
            [
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
              'function RouteComponent() { return <div>Hello "%%tsrPath%%"!</div> };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { createLazyFileRoute } from '@tanstack/react-router';",
            tsrExportStart: (routePath) =>
              `export const Route = createLazyFileRoute(${serializeRoutePath(routePath)})(`,
            tsrExportEnd: () => ');',
          },
        },
      }
    case 'solid':
      return {
        fullPkg: '@tanstack/solid-router',
        subPkg: 'solid-router',
        rootRoute: {
          template: () =>
            [
              'import * as Solid from "solid-js"\n',
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RootComponent\n }%%tsrExportEnd%%\n\n',
              'function RootComponent() { return (<><div>Hello "%%tsrPath%%"!</div><Outlet /></>) };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { Outlet, createRootRoute } from '@tanstack/solid-router';",
            tsrExportStart: () => 'export const Route = createRootRoute(',
            tsrExportEnd: () => ');',
          },
        },
        route: {
          template: () =>
            [
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
              'function RouteComponent() { return <div>Hello "%%tsrPath%%"!</div> };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { createFileRoute } from '@tanstack/solid-router';",
            tsrExportStart: (routePath) =>
              `export const Route = createFileRoute(${serializeRoutePath(routePath)})(`,
            tsrExportEnd: () => ');',
          },
        },
        lazyRoute: {
          template: () =>
            [
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
              'function RouteComponent() { return <div>Hello "%%tsrPath%%"!</div> };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { createLazyFileRoute } from '@tanstack/solid-router';",

            tsrExportStart: (routePath) =>
              `export const Route = createLazyFileRoute(${serializeRoutePath(routePath)})(`,

            tsrExportEnd: () => ');',
          },
        },
      }
    case 'vue':
      return {
        fullPkg: '@tanstack/vue-router',
        subPkg: 'vue-router',
        rootRoute: {
          template: () =>
            [
              'import { h } from "vue"\n',
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RootComponent\n }%%tsrExportEnd%%\n\n',
              'function RootComponent() { return h("div", {}, ["Hello \\"%%tsrPath%%\\"!", h(Outlet)]) };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { Outlet, createRootRoute } from '@tanstack/vue-router';",
            tsrExportStart: () => 'export const Route = createRootRoute(',
            tsrExportEnd: () => ');',
          },
        },
        route: {
          template: () =>
            [
              'import { h } from "vue"\n',
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
              'function RouteComponent() { return h("div", {}, "Hello \\"%%tsrPath%%\\"!") };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { createFileRoute } from '@tanstack/vue-router';",
            tsrExportStart: (routePath) =>
              `export const Route = createFileRoute(${serializeRoutePath(routePath)})(`,
            tsrExportEnd: () => ');',
          },
        },
        lazyRoute: {
          template: () =>
            [
              'import { h } from "vue"\n',
              '%%tsrImports%%',
              '\n\n',
              '%%tsrExportStart%%{\n component: RouteComponent\n }%%tsrExportEnd%%\n\n',
              'function RouteComponent() { return h("div", {}, "Hello \\"%%tsrPath%%\\"!") };\n',
            ].join(''),
          imports: {
            tsrImports: () =>
              "import { createLazyFileRoute } from '@tanstack/vue-router';",

            tsrExportStart: (routePath) =>
              `export const Route = createLazyFileRoute(${serializeRoutePath(routePath)})(`,

            tsrExportEnd: () => ');',
          },
        },
      }
    default:
      throw new Error(`router-generator: Unknown target type: ${target}`)
  }
}
