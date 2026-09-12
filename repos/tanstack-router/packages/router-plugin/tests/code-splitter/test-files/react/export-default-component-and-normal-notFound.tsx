import React, { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/home')({
  component: Home,
  notFoundComponent: NotFoundComponent,
})

function NotFoundComponent() {
  return <div>Not Found</div>
}

export default function Home() {
  const [one, setOne] = useState('this is from a state')

  return (
    <div>
      <h1>{one}</h1>
    </div>
  )
}
