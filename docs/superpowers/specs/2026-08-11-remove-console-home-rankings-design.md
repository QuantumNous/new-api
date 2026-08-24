# Remove Console Home and Rankings Navigation Design

## Goal

Remove the Home and Rankings links from the Flatkey authenticated console's top-right navigation.

## Scope

- Remove only Home and Rankings from the console top-navigation link builder.
- Keep Blog, Models, Docs, Pricing, Compute, and Use cases unchanged.
- Keep the sidebar, public website navigation, routes, and backend module settings unchanged.
- Preserve the earlier removal of Playground from the console header.

## Design

`buildTopNavLinks` is the single source for console header links. Delete the unconditional Home insertion and stop emitting the conditional Rankings entry. Keep parsing the existing header-navigation module configuration because Pricing still depends on it and other consumers may use Rankings configuration outside this builder.

Update the focused unit tests to lock the remaining ordered links and explicitly assert that Home, Rankings, and Playground are absent. Retain the Pricing authentication assertion so the change cannot accidentally weaken existing access-control behavior.

## Verification

- Run the focused test after changing only the expectations and confirm it fails because Home and Rankings are still emitted.
- Apply the minimal builder change and confirm the focused test passes.
- Run targeted ESLint and Prettier checks, TypeScript typecheck, and the production frontend build.
- Verify the final diff does not touch sidebar data, routes, backend configuration, or unrelated navigation items.
