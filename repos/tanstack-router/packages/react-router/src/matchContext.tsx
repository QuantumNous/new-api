'use client'

import * as React from 'react'

export const matchContext = React.createContext<string | undefined>(undefined)

// N.B. this only exists so we can conditionally call useContext on it when we are not interested in the nearest match
export const dummyMatchContext = React.createContext<string | undefined>(
  undefined,
)
