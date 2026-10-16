import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/inputs')({
  component: InputsPage,
})

function InputsPage() {
  return (
    <main className="hmr-card flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="hmr-label">Inputs route</p>
          <h1
            className="mt-2 font-display text-3xl font-bold text-[var(--color-night)]"
            data-testid="inputs-heading"
          >
            Uncontrolled Inputs
          </h1>
        </div>
        <p className="hmr-marker" data-testid="inputs-marker">
          inputs-baseline
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          className="hmr-input"
          data-testid="input-first"
          placeholder="First uncontrolled field"
          type="text"
        />
        <input
          className="hmr-input"
          data-testid="input-second"
          placeholder="Second uncontrolled field"
          type="text"
        />
      </div>
    </main>
  )
}
