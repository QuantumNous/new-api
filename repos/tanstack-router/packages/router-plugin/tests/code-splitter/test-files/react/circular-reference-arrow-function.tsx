import { createFileRoute } from '@tanstack/react-router'

function getComponentName(obj: Record<string, unknown>): string {
  return Object.keys(obj)[0]
}

const App = () => {
  const componentName = getComponentName({ App })

  return (
    <div>
      Component Name is {componentName}
      <OtherComponent />
    </div>
  )
}

function OtherComponent() {
  const componentName = getComponentName({ App })
  return <div>App component name is {componentName}</div>
}

export const Route = createFileRoute('/')({
  component: App,
})
