import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/params-ps/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <h3 class="pb-2">Named path params</h3>
      <ul class="grid mb-2">
        <li>
          <Link
            data-testid="l-to-named-foo"
            to="/params-ps/named/$foo"
            params={{ foo: 'foo' }}
          >
            /params-ps/named/$foo
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-named-foo-special-characters"
            to="/params-ps/named/$foo"
            params={{ foo: 'foo%\\/🚀대' }}
          >
            /params-ps/named/$foo - with special characters
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-named-prefixfoo"
            to="/params-ps/named/prefix{$foo}"
            params={{ foo: 'foo' }}
          >
            /params-ps/named/{'prefix{$foo}'}
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-named-foosuffix"
            to="/params-ps/named/{$foo}suffix"
            params={{ foo: 'foo' }}
          >
            /params-ps/named/{'{$foo}suffix'}
          </Link>
        </li>
      </ul>
      <hr />
      <h3 class="pb-2">Wildcard path params</h3>
      <ul class="grid mb-2">
        <li>
          <Link
            data-testid="l-to-wildcard-foo"
            to="/params-ps/wildcard/$"
            params={{ _splat: 'foo' }}
          >
            /params-ps/wildcard/$
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-escaped"
            to="/params-ps/wildcard/$"
            params={{ _splat: 'test[s\\/.\\/parameter%!🚀]' }}
          >
            /params-ps/wildcard/$ with escaped params
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-encoded"
            to="/params-ps/wildcard/$"
            params={{ _splat: '%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD' }}
          >
            /params-ps/wildcard/$ with encoded params
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-prefixfoo"
            to="/params-ps/wildcard/prefix{$}"
            params={{ _splat: 'foo' }}
          >
            /params-ps/wildcard/{'prefix{$}'}
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-prefix-escaped"
            to="/params-ps/wildcard/prefix@대{$}"
            params={{ _splat: 'test[s\\/.\\/parameter%!🚀]' }}
          >
            /params-ps/wildcard/{'prefix@대{$}'}
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-foosuffix"
            to="/params-ps/wildcard/{$}suffix"
            params={{ _splat: 'foo' }}
          >
            /params-ps/wildcard/{'{$}suffix'}
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-suffix-escaped"
            to="/params-ps/wildcard/{$}suffix@대"
            params={{ _splat: 'test[s\\/.\\/parameter%!🚀]' }}
          >
            /params-ps/wildcard/{'{$}suffix@대'}
          </Link>
        </li>
      </ul>
      <hr />
      <h3 class="pb-2">Non-nested path params</h3>
      <ul class="grid mb-2">
        <li>
          <Link data-testid="l-to-non-nested" to="/params-ps/non-nested">
            Non-nested
          </Link>
        </li>
      </ul>
    </div>
  )
}
