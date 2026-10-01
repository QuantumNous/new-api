import { Link, createFileRoute, linkOptions } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

const baseTestCase = linkOptions({
  to: '/posts/$postId',
  params: { postId: '1' },
})

const testCases = [
  {
    link: linkOptions({
      ...baseTestCase,
      search: {
        root: {
          ssr: undefined,
          expected: { data: 'server', render: 'server-and-client' },
        },
        posts: {
          ssr: undefined,

          expected: { data: 'server', render: 'server-and-client' },
        },
        postId: {
          ssr: undefined,

          expected: { data: 'server', render: 'server-and-client' },
        },
      },
    }),
  },
  {
    link: linkOptions({
      ...baseTestCase,
      search: {
        root: {
          ssr: false,
          expected: { data: 'client', render: 'client-only' },
        },
        posts: {
          ssr: undefined,

          expected: { data: 'client', render: 'client-only' },
        },
        postId: {
          ssr: undefined,

          expected: { data: 'client', render: 'client-only' },
        },
      },
    }),
  },
  {
    link: linkOptions({
      ...baseTestCase,
      search: {
        root: {
          ssr: false,
          expected: { data: 'client', render: 'client-only' },
        },
        posts: {
          ssr: false,
          expected: { data: 'client', render: 'client-only' },
        },
        postId: {
          ssr: true,
          expected: { data: 'client', render: 'client-only' },
        },
      },
    }),
  },
  {
    link: linkOptions({
      ...baseTestCase,
      search: {
        root: {
          ssr: true,
          expected: { data: 'server', render: 'server-and-client' },
        },
        posts: {
          ssr: false,
          expected: { data: 'client', render: 'client-only' },
        },
        postId: {
          ssr: undefined,

          expected: { data: 'client', render: 'client-only' },
        },
      },
    }),
  },
  {
    link: linkOptions({
      ...baseTestCase,
      search: {
        root: {
          ssr: true,
          expected: { data: 'server', render: 'server-and-client' },
        },
        posts: {
          ssr: 'data-only',
          expected: { data: 'server', render: 'client-only' },
        },
        postId: {
          ssr: undefined,

          expected: { data: 'server', render: 'client-only' },
        },
      },
    }),
  },
  {
    link: linkOptions({
      ...baseTestCase,
      search: {
        root: {
          ssr: 'data-only',
          expected: { data: 'server', render: 'client-only' },
        },
        posts: {
          ssr: true,
          expected: { data: 'server', render: 'client-only' },
        },
        postId: {
          ssr: undefined,

          expected: { data: 'server', render: 'client-only' },
        },
      },
    }),
  },
  {
    link: linkOptions({
      ...baseTestCase,
      search: {
        root: {
          ssr: true,
          expected: { data: 'server', render: 'server-and-client' },
        },
        posts: {
          ssr: true,
          expected: { data: 'server', render: 'server-and-client' },
        },
        postId: {
          ssr: false,
          expected: { data: 'client', render: 'client-only' },
        },
      },
    }),
  },
]

function Home() {
  const links = testCases.map((t, index) => {
    const key = `testcase-${index}-link`

    return (
      <div key={key}>
        <Link data-testid={key} {...t.link} reloadDocument={true}>
          root: {JSON.stringify(t.link.search.root.ssr ?? 'undefined')} posts:{' '}
          {JSON.stringify(t.link.search.posts.ssr ?? 'undefined')} $postId:{' '}
          {JSON.stringify(t.link.search.postId.ssr ?? 'undefined')}
        </Link>
        <br />
        <br />
      </div>
    )
  })

  return (
    <>
      <div>
        test count: <b data-testid="test-count">{links.length}</b>
      </div>
      <div>{links}</div>
    </>
  )
}
