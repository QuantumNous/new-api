import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

const MyRoute = createFileRoute('/export-with-as')({})

export { MyRoute as Route }
