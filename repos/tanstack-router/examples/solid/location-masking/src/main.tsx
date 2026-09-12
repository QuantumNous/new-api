import type { JSX } from 'solid-js'
import { render } from 'solid-js/web'
import {
  ErrorComponent,
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouteMask,
  createRouter,
  useNavigate,
  useRouterState,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import type { ErrorComponentProps } from '@tanstack/solid-router'
import './styles.css'

type PhotoType = {
  id: string
  title: string
  url: string
  thumbnailUrl: string
  albumId: string
}

class NotFoundError extends Error {}

const fetchPhotos = async () => {
  console.info('Fetching photos...')
  await new Promise((r) => setTimeout(r, 500))
  // Generate mock photos using picsum.photos since via.placeholder.com is down
  return Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 1),
    title: `Photo ${i + 1}`,
    url: `https://picsum.photos/600/400?random=${i + 1}`,
    thumbnailUrl: `https://picsum.photos/200/200?random=${i + 1}`,
    albumId: '1',
  }))
}

const fetchPhoto = async (photoId: string) => {
  console.info(`Fetching photo with id ${photoId}...`)
  await new Promise((r) => setTimeout(r, 500))

  // Simulate photo not found for invalid IDs
  const photoIdNum = parseInt(photoId, 10)
  if (isNaN(photoIdNum) || photoIdNum < 1 || photoIdNum > 10) {
    throw new NotFoundError(`Photo with id "${photoId}" not found!`)
  }

  // Generate mock photo using picsum.photos
  return {
    id: photoId,
    title: `Photo ${photoId}`,
    url: `https://picsum.photos/600/400?random=${photoId}`,
    thumbnailUrl: `https://picsum.photos/200/200?random=${photoId}`,
    albumId: '1',
  }
}

type PhotoModal = {
  id: 'photo'
  photoId: string
}

type ModalObject = PhotoModal

export function Spinner() {
  return (
    <div class="animate-spin px-3 text-xl inline-flex items-center justify-center">
      ⍥
    </div>
  )
}

const rootRoute = createRootRoute({
  validateSearch: (search) =>
    search as {
      modal?: ModalObject
    },
  component: RootComponent,
})

function RootComponent() {
  const status = useRouterState({ select: (s) => s.status })

  return (
    <>
      <div class="p-2 flex gap-2 text-lg">
        <Link
          to="/"
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>{' '}
        <Link
          to="/photos"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Photos
        </Link>{' '}
        {status() === 'pending' ? <Spinner /> : null}
      </div>
      <hr />
      <Outlet />
      {/* Start rendering router matches */}
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

function Modal(props: {
  children: JSX.Element
  onOpenChange?: (open: boolean) => void
}) {
  const handleOverlayClick = () => {
    props.onOpenChange?.(false)
  }

  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      class="fixed inset-0 bg-black/70 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        onClick={handleContentClick}
      >
        {props.children}
      </div>
    </div>
  )
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => {
    return (
      <div class="p-2">
        <h3>Welcome Home!</h3>
      </div>
    )
  },
})
const photosLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'photos',
  loader: fetchPhotos,
  component: PhotosRoute,
})

function PhotosRoute() {
  const photos = photosLayoutRoute.useLoaderData()

  return (
    <div class="p-2 space-y-2">
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {[
          ...photos(),
          { id: 'i-do-not-exist', title: 'Missing Photo Test', url: '' },
        ].map((photo) => {
          return (
            <li class="">
              <Link
                to={photoModalRoute.to}
                params={{
                  photoId: photo.id,
                }}
                // If you want to use a mask, you can do so like this, but
                // it's generally safer to set up a route mask instead.
                // mask={{
                //   to: photoRoute.to,
                //   params: {
                //     photoId: photo.id,
                //   },
                // }}
                class="whitespace-nowrap border rounded-lg shadow-xs flex items-center hover:shadow-lg text-blue-600 hover:scale-[1.1] overflow-hidden transition-all"
              >
                <img src={photo.url} alt={photo.title} class="max-w-full" />
              </Link>
            </li>
          )
        })}
      </ul>
      <Outlet />
    </div>
  )
}

const photoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'photos/$photoId',
  loader: async ({ params: { photoId } }) => fetchPhoto(photoId),
  errorComponent: PhotoErrorComponent,
  component: PhotoComponent,
})

function PhotoErrorComponent({ error }: ErrorComponentProps) {
  return (
    <div class="p-4">
      {(() => {
        if (error instanceof NotFoundError) {
          return <div>{error.message}</div>
        }
        return <ErrorComponent error={error} />
      })()}
    </div>
  )
}

function PhotoComponent() {
  const photo = photoRoute.useLoaderData()

  return (
    <div class="p-4">
      <Photo photo={photo()} />
    </div>
  )
}

const photoModalRoute = createRoute({
  getParentRoute: () => photosLayoutRoute,
  path: '$photoId/modal',
  loader: async ({ params: { photoId } }) => fetchPhoto(photoId),
  errorComponent: PhotoModalErrorComponent,
  // pendingComponent: PhotoModalPendingComponent,
  component: PhotoModalComponent,
})

function PhotoModalErrorComponent({ error }: ErrorComponentProps) {
  const navigate = useNavigate()

  return (
    <Modal
      onOpenChange={(open) => {
        if (!open) {
          navigate({
            to: photosLayoutRoute.to,
          })
        }
      }}
    >
      <div class="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
        {(() => {
          if (error instanceof NotFoundError) {
            return <div>{error.message}</div>
          }
          return <ErrorComponent error={error} />
        })()}
      </div>
    </Modal>
  )
}

function _PhotoModalPendingComponent() {
  const navigate = useNavigate()

  return (
    <Modal
      onOpenChange={(open) => {
        if (!open) {
          navigate({
            to: photosLayoutRoute.to,
          })
        }
      }}
    >
      <div class="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
        <Spinner />
      </div>
    </Modal>
  )
}

function PhotoModalComponent() {
  const navigate = useNavigate()
  const photo = photoModalRoute.useLoaderData()

  return (
    <Modal
      onOpenChange={(open) => {
        if (!open) {
          navigate({
            to: photosLayoutRoute.to,
          })
        }
      }}
    >
      <div class="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
        <Link
          to="."
          target="_blank"
          class="text-blue-600 hover:opacity-75 underline"
        >
          Open in new tab (to test de-masking)
        </Link>
        <Photo photo={photo()} />
      </div>
    </Modal>
  )
}

function Photo({ photo }: { photo: PhotoType }) {
  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{photo.title}</h4>
      <div class="">
        <img src={photo.url} alt={photo.title} class="max-w-full" />
      </div>
    </div>
  )
}

const routeTree = rootRoute.addChildren([
  photoRoute,
  photosLayoutRoute.addChildren([photoModalRoute]),
  indexRoute,
])

const photoModalToPhotoMask = createRouteMask({
  routeTree,
  from: '/photos/$photoId/modal',
  to: '/photos/$photoId',
  params: true,
})

// Set up a Router instance
const router = createRouter({
  routeTree,
  routeMasks: [photoModalToPhotoMask],
  defaultPreload: 'intent',
  scrollRestoration: true,
})

// Register things for typesafety
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement)
}
