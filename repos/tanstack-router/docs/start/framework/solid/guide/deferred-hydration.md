---
ref: docs/start/framework/react/guide/deferred-hydration.md
replace:
  '@tanstack/react-start': '@tanstack/solid-start'
  'React handlers': 'Solid handlers'
  'one React tree': 'one Solid tree'
  'Comparison To React Selective Hydration': 'Comparison To Solid Streaming Hydration'
  "React's selective hydration controls the order in which server-rendered boundaries hydrate. Deferred hydration controls whether and when each boundary hydrates at all.": "Solid's streaming hydration controls the order in which server-rendered boundaries hydrate. Deferred hydration controls whether and when each boundary hydrates at all."
  'When React hydrates a streaming SSR page, every server-rendered `<Suspense>` boundary will eventually hydrate. Selective hydration just decides the order: each boundary hydrates as soon as its code arrives, and React jumps a boundary to the front of the queue if the user clicks inside it. The work is fixed by what the server rendered; React schedules it to feel responsive.': 'When Solid hydrates a streaming SSR page, every server-rendered `<Suspense>` boundary will eventually hydrate. Streaming hydration just decides the order: each boundary hydrates as its resources resolve and stream from the server. The work is fixed by what the server rendered; Solid streams it to feel responsive.'
  "The two compose. A `Hydrate` boundary decides whether and when React starts hydrating a subtree; once it opens, anything inside it (including `<Suspense>` boundaries) flows back into React's normal hydration scheduler. Use `<Suspense>` when hydration must happen and you want React to prioritize it well. Use `Hydrate` when hydration might not need to happen at all.": "The two compose. A `Hydrate` boundary decides whether and when Solid starts hydrating a subtree; once it opens, anything inside it (including `<Suspense>` boundaries) flows back into Solid's normal hydration scheduler. Use `<Suspense>` when hydration must happen and you want Solid to prioritize it well. Use `Hydrate` when hydration might not need to happen at all."
  'ReactNode': 'JSX.Element'
  "Deferred hydration is a performance hint for React's initial hydration work. React may hydrate a deferred boundary earlier than its strategy would normally allow if state, props, context, or store updates outside the boundary require React to reconcile inside it before the gate opens. This preserves correctness and avoids showing stale server HTML after the surrounding app has changed.": "Deferred hydration is a performance hint for Solid's initial hydration work. Once a boundary gate opens, TanStack Start clears the preserved server DOM inside the marker and mounts the live Solid subtree in its place."
  'Hook calls directly inside extracted JSX': 'Render-time `use*` calls directly inside extracted JSX'
  'Moving that JSX would move where the hook executes.': 'Moving that JSX would move where the call executes.'
  'Move the hook call into a component inside the boundary, then render that component.': 'Move the call into a component inside the boundary, then render that component.'
  'Move the hook into a component instead:': 'Move the call into a component instead:'
---
