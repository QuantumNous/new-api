import { createFileRoute } from '@tanstack/react-router'

// This file uses blog[_] escaping to create a literal /blog_ path
// with the trailing underscore preserved in the URL
export const Route = createFileRoute('/blog_')({
  component: EscapedBlogUnderscoreComponent,
})

function EscapedBlogUnderscoreComponent() {
  return (
    <div>
      <h2 data-testid="page-title">Escaped Blog Underscore Page</h2>
      <p data-testid="page-path">/blog_</p>
      <p data-testid="page-description">
        This route was created using blog[_].tsx to escape the trailing
        underscore. It renders at the literal path /blog_ with the underscore
        preserved in the URL.
      </p>
    </div>
  )
}
