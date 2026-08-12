import * as React from 'react'

export function CustomMessage({ message }: { message: string }) {
  return (
    <div className="py-2">
      <div className="italic">This is a custom message:</div>
      <p>{message}</p>
    </div>
  )
}
