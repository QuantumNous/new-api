import { createFileRoute } from '@tanstack/solid-router'
import { Header } from '../components/Header'
import { Content } from '../components/Content'

export const Index = () => {
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
