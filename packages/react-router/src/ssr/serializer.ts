import type * as React from 'react'

declare module '@tanstack/router-core' {
  export interface SerializerExtensions {
    ReadableStream: React.JSX.Element
  }
}
