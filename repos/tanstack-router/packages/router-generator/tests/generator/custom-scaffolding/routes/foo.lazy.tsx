import React, { useState } from 'react'
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/foo')({
  component: RouteComponent,
})

function RouteComponent() {
  return 'Hello /foo!'
}
