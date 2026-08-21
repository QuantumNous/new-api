// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/posts')({
  component: () => <div>Hello /posts!</div>,
})
