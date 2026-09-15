'use client'

import * as React from 'react'
import type { AnyRouter } from '@tanstack/router-core'

export const routerContext = React.createContext<AnyRouter>(null!)
