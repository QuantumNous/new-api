import type { ReactNode } from 'react'

interface DemoSectionProps {
  title: string
  description: string
  children: ReactNode
}

export function DemoSection({
  title,
  description,
  children,
}: DemoSectionProps) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}
