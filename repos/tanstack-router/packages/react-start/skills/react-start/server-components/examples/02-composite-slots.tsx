// Composite Component patterns:
// - children slot for free-form composition
// - render-prop slot when the server must pass data into client UI
// - component prop slot for reusable typed interactive controls

import type { ComponentType, ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'
import { z } from 'zod'

// Replace with your own server-only data layer
declare const db: {
  posts: {
    findById(postId: string): Promise<{
      id: string
      authorId: string
      title: string
      body: string
    }>
  }
  products: {
    findById(productId: string): Promise<{
      id: string
      name: string
      price: number
    }>
  }
}

const getPostCard = createServerFn({ method: 'GET' })
  .validator(z.object({ postId: z.string() }))
  .handler(async ({ data }) => {
    const post = await db.posts.findById(data.postId)

    const src = await createCompositeComponent<{
      children?: ReactNode
      renderActions?: (args: { postId: string; authorId: string }) => ReactNode
    }>((props) => (
      <article className="card">
        <h1>{post.title}</h1>
        <p>{post.body}</p>

        <footer>
          {props.renderActions?.({
            postId: post.id,
            authorId: post.authorId,
          })}
        </footer>

        <section>{props.children}</section>
      </article>
    ))

    return { src }
  })

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) =>
    getPostCard({ data: { postId: params.postId } }),
  component: PostPage,
})

function PostPage() {
  const { src } = Route.useLoaderData()

  return (
    <CompositeComponent
      src={src}
      renderActions={({ postId, authorId }) => (
        <PostActions postId={postId} authorId={authorId} />
      )}
    >
      <Comments />
    </CompositeComponent>
  )
}

function Comments() {
  return <div>Interactive comments go here</div>
}

function PostActions(props: { postId: string; authorId: string }) {
  return (
    <button type="button">
      Moderate {props.postId} / {props.authorId}
    </button>
  )
}

// Component-prop slot variant
const getProductCard = createServerFn({ method: 'GET' })
  .validator(z.object({ productId: z.string() }))
  .handler(async ({ data }) => {
    const product = await db.products.findById(data.productId)

    const src = await createCompositeComponent<{
      AddToCart?: ComponentType<{ productId: string; price: number }>
    }>((props) => (
      <section className="product-card">
        <h2>{product.name}</h2>
        {props.AddToCart ? (
          <props.AddToCart productId={product.id} price={product.price} />
        ) : null}
      </section>
    ))

    return { src }
  })

function AddToCartButton(props: { productId: string; price: number }) {
  return (
    <button type="button">
      Add {props.productId} at {props.price}
    </button>
  )
}

// Example usage somewhere else:
// const { src } = await getProductCard({ data: { productId: 'p-1' } })
// <CompositeComponent src={src} AddToCart={AddToCartButton} />
