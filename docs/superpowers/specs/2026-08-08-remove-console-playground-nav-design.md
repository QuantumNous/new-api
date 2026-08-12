# Remove Console Playground Top Navigation Design

## Goal

Remove the Playground link from the Flatkey console's top-right navigation while preserving the sidebar Playground entry and the `/playground` route.

## Scope

- Change only the console top-navigation link builder.
- Keep Home, Blog, Models, Docs, Rankings, Pricing, Compute, and Use cases unchanged.
- Keep the authenticated sidebar Playground entry unchanged.
- Keep Playground routing and functionality unchanged.

## Design

`buildTopNavLinks` is the single source for the console header links. Remove the unconditional Playground website link from that ordered list. Update its focused unit test to lock the resulting order and explicitly assert that Playground is absent.

No backend configuration, routing, localization, or website navigation changes are required.

## Verification

- Run the focused top-navigation unit test and observe the new assertion fail before implementation.
- Remove the top-navigation entry and rerun the focused test.
- Run the console typecheck and production build.
- Inspect the final diff to confirm only the header builder, focused test, and planning documents changed.
