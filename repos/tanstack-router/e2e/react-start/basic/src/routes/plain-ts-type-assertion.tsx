import { createFileRoute } from '@tanstack/react-router'
import { cast } from '~/utils/cast'

export const Route = createFileRoute('/plain-ts-type-assertion')({
  component: PlainTsTypeAssertion,
})

const regressionValue = cast<string>('plain .ts cast parsed')

function PlainTsTypeAssertion() {
  return (
    <div className="p-2">
      <h3>Plain TS Type Assertion</h3>
      <p data-testid="plain-ts-parser-regression">{regressionValue}</p>
    </div>
  )
}
