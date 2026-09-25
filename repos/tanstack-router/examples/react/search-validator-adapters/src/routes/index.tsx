import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

import { Header } from '../components/Header'
import { Content } from '../components/Content'

export const Index: React.FunctionComponent = () => {
  return (
    <>
      <Header title="Home" />
      <Content>Welcome home</Content>
    </>
  )
}

export const Route = createFileRoute('/')({
  component: Index,
})
