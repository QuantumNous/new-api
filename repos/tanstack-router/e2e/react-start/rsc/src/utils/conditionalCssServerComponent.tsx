import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { ConditionalOrangePanel } from './ConditionalOrangePanel'
import { ConditionalVioletPanel } from './ConditionalVioletPanel'

export const getConditionalCssServerComponent = createServerFn({
  method: 'GET',
})
  .validator((data: { branch?: 'orange' | 'violet' }) => data)
  .handler(async ({ data }) => {
    const branch = data.branch === 'violet' ? 'violet' : 'orange'

    return renderServerComponent(
      <>
        {branch === 'violet' ? (
          <ConditionalVioletPanel />
        ) : (
          <ConditionalOrangePanel />
        )}
      </>,
    )
  })
