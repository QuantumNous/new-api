import { createFileRoute } from '@tanstack/react-router'
import '~/styles/quotes.css'

export const Route = createFileRoute('/quotes')({
  component: Quotes,
})

function Quotes() {
  return (
    <div>
      <h1>CSS Collection Test - Quoted Content</h1>
      <p>This page tests that CSS with quoted content is properly extracted.</p>

      <div className="quote-test" data-testid="quote-styled">
        This element uses CSS with content: "..." property
      </div>

      <div className="after-quote" data-testid="after-quote-styled">
        This element's styles come after the quoted content - should still work
      </div>
    </div>
  )
}
