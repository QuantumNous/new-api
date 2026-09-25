import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

import * as styles from '../style.css'
import { TEST_DATA } from '../test.const'

const Button = (props: { children: any }) => {
  return <button>{props.children}</button>
}

export const Route = createFileRoute('/')({
  component: () => {
    return (
      <div className="p-2">
        {test}
        <h3 className={styles.indexPageTitle}>{TEST_DATA.welcome}</h3>
        <Button>Click me</Button>
      </div>
    )
  },
})

Route.addChildren([])

export const test = 'test'
