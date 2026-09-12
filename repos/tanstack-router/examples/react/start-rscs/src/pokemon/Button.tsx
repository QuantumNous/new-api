'use client'

export function Button({
  className,
  title,
}: {
  className?: string
  title?: string
}) {
  return (
    <button
      onClick={() => alert(`${title} clicked`)}
      type="button"
      className={`bg-blue-500 text-white px-4 py-2 rounded-md ${className}`}
    >
      {title}
    </button>
  )
}
