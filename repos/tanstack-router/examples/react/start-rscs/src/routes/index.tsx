import { Link, createFileRoute } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import type { DemoInfo } from '~/home/server-functions'
import { getHomePage } from '~/home/server-functions'

export const Route = createFileRoute('/')({
  loader: async () => {
    const HomePage = await getHomePage()
    return { HomePage }
  },
  component: Home,
})

function DemoCard({ demo }: { demo: DemoInfo }) {
  return (
    <Link to={demo.path} className="block group">
      <div className="border-6 border-dashed border-green-500 bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
        <div className={`h-2 bg-linear-to-r ${demo.color}`} />
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
            {demo.title}
          </h2>
          <p className="text-gray-600 mt-2">{demo.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {demo.features.map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
              >
                {feature}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center text-indigo-600 font-medium">
            View Demo
            <svg
              className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

function Home() {
  const { HomePage } = Route.useLoaderData()

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="border-6 border-solid border-blue-500 rounded-xl p-6 bg-gray-100">
          <CompositeComponent
            src={HomePage.src}
            renderDemoCard={({ demo }) => <DemoCard demo={demo} />}
          />
        </div>
      </div>
    </div>
  )
}
