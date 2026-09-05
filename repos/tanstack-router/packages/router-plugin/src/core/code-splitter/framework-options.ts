type FrameworkOptions = {
  package: string
  idents: {
    createFileRoute: string
    lazyFn: string
    lazyRouteComponent: string
  }
}

export function getFrameworkOptions(framework: string): FrameworkOptions {
  let frameworkOptions: FrameworkOptions

  switch (framework) {
    case 'react':
      frameworkOptions = {
        package: '@tanstack/react-router',
        idents: {
          createFileRoute: 'createFileRoute',
          lazyFn: 'lazyFn',
          lazyRouteComponent: 'lazyRouteComponent',
        },
      }
      break
    case 'solid':
      frameworkOptions = {
        package: '@tanstack/solid-router',
        idents: {
          createFileRoute: 'createFileRoute',
          lazyFn: 'lazyFn',
          lazyRouteComponent: 'lazyRouteComponent',
        },
      }
      break
    case 'vue':
      frameworkOptions = {
        package: '@tanstack/vue-router',
        idents: {
          createFileRoute: 'createFileRoute',
          lazyFn: 'lazyFn',
          lazyRouteComponent: 'lazyRouteComponent',
        },
      }
      break
    default:
      throw new Error(
        `[getFrameworkOptions] - Unsupported framework: ${framework}`,
      )
  }

  return frameworkOptions
}
