import { createFileRoute } from '@tanstack/react-router'
import { Tweet } from 'react-tweet'

export const Route = createFileRoute('/noexternal-client-pkg')({
  component: NoExternalClientPkg,
})

function NoExternalClientPkg() {
  return (
    <div>
      <h1 data-testid="noexternal-heading">noExternal .client Package</h1>
      <div data-testid="noexternal-tweet">
        <Tweet id="2023917847961821693" />
      </div>
    </div>
  )
}
