import { createFileRoute } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { getProductPage } from '~/e-Commerce/server-functions'
import { AddToCartButton } from '~/e-Commerce/components/AddToCartButton'
import { AlsoBoughtCarousel } from '~/e-Commerce/components/AlsoBoughtCarousel'
import { Header } from '~/e-Commerce/components/Header'
import { StreamingComments } from '~/e-Commerce/components/StreamingComments'

export const Route = createFileRoute('/e-commerce')({
  loader: async () => {
    const ProductPage = await getProductPage()
    return { ProductPage }
  },
  component: ECommercePage,
})

function ECommercePage() {
  const { ProductPage } = Route.useLoaderData()

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4">
        {/* Page Header with Cart */}
        <Header />

        {/* Main Product Section */}
        <CompositeComponent
          src={ProductPage.src}
          renderAlsoBought={({ products }) => (
            <AlsoBoughtCarousel products={products} />
          )}
        >
          <AddToCartButton />
        </CompositeComponent>

        {/* Customer Reviews Section */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Customer Reviews
          </h2>
          <div className="border-6 border-solid border-blue-500 rounded-xl p-4 bg-white shadow-lg">
            <StreamingComments />
          </div>
        </section>
      </div>
    </div>
  )
}
