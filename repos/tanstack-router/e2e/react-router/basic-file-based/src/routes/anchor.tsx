import { createFileRoute } from '@tanstack/react-router'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/anchor')({
  component: AnchorComponent,
})

const anchors: Array<{
  id: string
  title: string
  hashScrollIntoView?: boolean | ScrollIntoViewOptions
}> = [
  {
    id: 'default-anchor',
    title: 'Default Anchor',
  },
  {
    id: 'false-anchor',
    title: 'No Scroll Into View',
    hashScrollIntoView: false,
  },
  {
    id: 'smooth-scroll',
    title: 'Smooth Scroll',
    hashScrollIntoView: { behavior: 'smooth' },
  },
] as const

function AnchorSection({ id, title }: { id: string; title: string }) {
  const [hasShown, setHasShown] = useState(false)
  const elementRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!hasShown && entry.isIntersecting) {
          setHasShown(true)
        }
      },
      { threshold: 0.01 },
    )

    const currentRef = elementRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasShown])

  return (
    <div id={id} className="p-2 min-h-dvh">
      <h1
        data-testid={`heading-${id}`}
        className="font-bold text-xl pt-10"
        ref={elementRef}
      >
        {title}
        {hasShown ? ' (shown)' : ''}
      </h1>
    </div>
  )
}

function AnchorComponent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [withScroll, setWithScroll] = useState(true)

  return (
    <div className="flex flex-col w-full">
      <nav className="sticky top-0 z-10 p-2 bg-gray-50 dark:bg-gray-900 border-b">
        <ul className="inline-flex gap-2">
          {anchors.map((anchor) => (
            <li key={anchor.id}>
              <Link
                from={Route.fullPath}
                data-testid={`link-${anchor.id}`}
                hash={anchor.id}
                activeOptions={{ includeHash: true }}
                activeProps={{
                  className: 'font-bold active',
                }}
                hashScrollIntoView={anchor.hashScrollIntoView}
              >
                {anchor.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="overflow-auto">
        <form
          className="p-2 space-y-2 min-h-dvh"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const formData = new FormData(event.target as HTMLFormElement)

            const toHash = formData.get('hash') as string

            if (!toHash) {
              return
            }

            const hashScrollIntoView = withScroll
              ? ({
                  behavior: formData.get('scrollBehavior') as ScrollBehavior,
                  block: formData.get('scrollBlock') as ScrollLogicalPosition,
                  inline: formData.get('scrollInline') as ScrollLogicalPosition,
                } satisfies ScrollIntoViewOptions)
              : false

            navigate({ hash: toHash, hashScrollIntoView })
          }}
        >
          <h1 className="font-bold text-xl">Scroll with navigate</h1>
          <div className="space-y-2">
            <label>
              <span>Target Anchor</span>
              <select
                className="border border-opacity-50 rounded-sm p-2 w-full"
                data-testid="hash-select"
                defaultValue={location.hash || anchors[0].id}
                name="hash"
              >
                {anchors.map((anchor) => (
                  <option key={anchor.id} value={anchor.id}>
                    {anchor.title}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label>
                <input
                  checked={withScroll}
                  data-testid="with-scroll"
                  onChange={(e) => setWithScroll(e.target.checked)}
                  type="checkbox"
                />{' '}
                Scroll Into View
              </label>
            </div>
          </div>
          {withScroll ? (
            <>
              <div className="space-y-2">
                <label>
                  <span>Behavior</span>
                  <select
                    className="border border-opacity-50 rounded-sm p-2 w-full"
                    data-testid="behavior-select"
                    defaultValue="instant"
                    name="scrollBehavior"
                  >
                    <option value="instant">instant</option>
                    <option value="smooth">smooth</option>
                    <option value="auto">auto</option>
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <label>
                  <span>Block</span>
                  <select
                    className="border border-opacity-50 rounded-sm p-2 w-full"
                    data-testid="block-select"
                    defaultValue="start"
                    name="scrollBlock"
                  >
                    <option value="start">start</option>
                    <option value="center">center</option>
                    <option value="end">end</option>
                    <option value="nearest">nearest</option>
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <label>
                  <span>Inline</span>
                  <select
                    className="border border-opacity-50 rounded-sm p-2 w-full"
                    data-testid="inline-select"
                    defaultValue="nearest"
                    name="scrollInline"
                  >
                    <option value="start">start</option>
                    <option value="center">center</option>
                    <option value="end">end</option>
                    <option value="nearest">nearest</option>
                  </select>
                </label>
              </div>
            </>
          ) : null}
          <div>
            <button
              className="bg-blue-500 rounded-sm p-2 uppercase text-white font-black disabled:opacity-50"
              data-testid="navigate-button"
            >
              Navigate
            </button>
          </div>
        </form>

        {anchors.map((anchor) => (
          <AnchorSection key={anchor.id} id={anchor.id} title={anchor.title} />
        ))}
      </main>
    </div>
  )
}
