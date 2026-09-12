import { Link, createFileRoute, linkOptions } from '@tanstack/solid-router'
import {
  ListItems,
  MyLink,
  customRedirect,
  useCustomNavigate,
} from '~/typePrimitives'

export const Route = createFileRoute('/linkProps')({
  component: LinkPropsPage,
  loader: () => {
    throw customRedirect({
      to: '/search/searchPlaceholder',
      search: {
        searchPlaceholder: 'searchPlaceholder',
        rootSearch: 0,
        page: 0,
        offset: 0,
        search: 'hi',
      },
    })
  },
})

function LinkPropsPage() {
  useCustomNavigate({
    to: '/search/searchPlaceholder',
    search: {
      searchPlaceholder: 'searchPlaceholder',
      rootSearch: 0,
      page: 0,
      offset: 0,
      search: 'hi',
    },
  })

  const linkProps = linkOptions({
    to: '/absolute',
  })

  return (
    <>
      <MyLink
        from="/search/searchPlaceholder"
        to="../searchPlaceholder"
        search={{
          searchPlaceholder: 'searchPlaceholder',
          rootSearch: 0,
          page: 0,
          offset: 0,
          search: 'hi',
        }}
      />
      <ListItems
        from="/search/searchPlaceholder"
        items={[
          {
            to: '../searchPlaceholder',
            search: {
              searchPlaceholder: 'searchPlaceholder',
              rootSearch: 0,
              page: 0,
              offset: 0,
              search: 'hi',
            },
          },
        ]}
      />
      <Link {...linkProps} />
    </>
  )
}
