---
title: Versioning
description: "Versioning strategy and compatibility information for Zod 4"
---


import { Callout } from "fumadocs-ui/components/callout";


### **Update — July 8th, 2025**

`zod@4.0.0` has been published to `npm`. The package root (`"zod"`) now exports Zod 4. All other subpaths have not changed and will remain available forever.

To upgrade to Zod 4:

```
npm install zod@^4.0.0
```

If you are using Zod 4, your existing imports (`"zod/v4"` and `"zod/v4-mini"`) will continue to work forever. However, after upgrading, you can *optionally* rewrite your imports as follows:


|                | Before   | After     |
|----------------|-----------------|-------------|
| Zod 4          | `"zod/v4"`      | `"zod"`     |
| Zod 4 Mini     | `"zod/v4-mini"` | `"zod/mini"`|
| Zod 3          | `"zod"`         | `"zod/v3"`  |


**Library authors** — if you've already implemented Zod 4 support according to the best practices outlined in the [Library authors](/library-authors) guide, bump your peer dependency to include `zod@^4.0.0`:

```json
// package.json
{
  "peerDependencies": {
    "zod": "^3.25.0 || ^4.0.0"
  }
}
```

*There should be no other code changes necessary.* No code changes were made between the latest `3.25.x` release and `4.0.0`. This does not require a major version bump.

<details>
<summary><strong>Some notes on subpath versioning</strong></summary>

Ultimately, the subpath versioning scheme was a necessary evil to force the ecosystem to upgrade in a non-breaking way. If I'd published `zod@4.0.0` out of the gate, most libraries would have naively bumped their peer dependencies, forcing a "version bump avalanche" across the ecosystem.

As it stands, there is now [broad support](https://x.com/colinhacks/status/1932323805705482339) for Zod 4 across the ecosystem. No migration process is totally painless, but it seems like the "version avalanche" I'd feared didn't happen. By and large, libraries have been able to support Zod 3 and Zod 4 simultaneously: Hono, LangChain, React Hook Form, etc. Several ecosystem maintainers reached out to me specifically to indicate how convenient it was to incrementally add support for Zod 4 (something that would typically require a major version bump). Long story short: this approach worked great! Few other libraries are subject to the same constraints as Zod, but I strongly encourage other libraries with large associated ecosystems to consider a similar approach.
</details>

## Versioning in Zod 4

This is a writeup of Zod 4's approach to versioning, with the goal of making it easier for users and Zod's ecosystem of associated libraries to migrate to Zod 4.

The general approach:

- Zod 4 will not initially be published as `zod@4.0.0` on npm. Instead it will be exported at a subpath (`"zod/v4"`) alongside `zod@3.25.0` 
- Despite this, Zod 4 is considered stable and production-ready
- Zod 3 will continue to be exported from the package root (`"zod"`) as well as a new subpath `"zod/v3"`. It will continue to receive bug fixes & stability improvements.
 
> This approach is analogous to how Golang handles major version changes: https://go.dev/doc/modules/major-version

Sometime later:

- The package root (`"zod"`) will switch over from exporting Zod 3 to Zod 4
- At this point `zod@4.0.0` will get published to npm
- The `"zod/v4"` subpath will remain available forever

## Why? 

Zod occupies a unique place in the ecosystem. Many libraries/frameworks in the ecosystem accept user-defined Zod schemas. This means their user-facing API is strongly coupled to Zod and its various classes/interfaces/utilities. For these libraries/frameworks, a breaking change to Zod necessarily causes a breaking change for their users. A Zod 3 `ZodType` is not assignable to a Zod 4 `ZodType`.


### Why can't libraries just support v3 and v4 simultaneously? 

Unfortunately the limitations of peerDependencies (and inconsistencies between package managers) make it extremely difficult to elegantly support two major versions of one library simultaneously.

If I naively published `zod@4.0.0` to npm, the vast majority of the libraries in Zod's ecosystem would need to publish a new major version to properly support Zod 4, include some high-profile libraries like the AI SDK. It would trigger a "version bump avalanche" across the ecosystem and generally create a huge amount of frustration and work. 
  
With subpath versioning, we solve this problem. it provides a straightforward way for libraries to support Zod 3 and Zod 4 (including Zod Mini) simultaneously. They can continue defining a single peerDependency on `"zod"`; no need for more arcane solutions like npm aliases, optional peer dependencies, a `"zod-compat"` package, or other such hacks.

Libraries will need to bump the minimum version of their `"zod"` peer dependency to `zod@^3.25.0`. They can then reference both Zod 3 and Zod 4 in their implementation:

  ```ts 
  import * as z3 from "zod/v3"
  import * as z4 from "zod/v4"
  ```

Later, once there's broad support for v4, we'll bump the major version on `npm` and start exporting Zod 4 from the package root, completing the transition. (This has now happened—see the note at the top of this page.)

As long as libraries are importing exclusively from the associated subpaths (not the root), their implementations will continue to work across the major version bump without code changes.

While it may seem unorthodox (at least for people who don't use Go!), this is the only approach I'm aware of that enables a clean, incremental migration path for both Zod's users and the libraries in the broader ecosystem.

---

A deeper dive into why peer dependencies don't work in this situation.

Imagine you're a library trying to build a function `acceptSchema` that accepts a Zod schema. You want to be able to accept Zod 3 or Zod 4 schemas.  In this hypothetical, I'm imagine Zod 4 was published as `zod@4` on npm, no subpaths. Here are your options:

1. Install both zod@3 and zod@4 as `dependencies` simultaneously using npm aliases. This works but you end up including your own copies of both Zod 3 and Zod 4. You have no guarantee that your user's Zod schemas are instances of the same z.ZodType class you're pulling from dependencies (`instanceof` checks will probably fail). 

2. Use a peer dependency that spans multiple major versions:  `"zod@>=3.0.0"` …but when developing a library you’d still need to pick a version to develop against. Usually you'd install this as a dev dependency. The onus is on you to painstakingly ensure your code works, character-for-character,  across both versions. This is impossible in the case of Zod 3 & Zod 4 because a number of very fundamental classes have simplified/different generics.

3. Optional peer dependencies. i just couldn't find a straight answer about how to reliably determine which peer dep is installed at runtime across all platforms. Many answers online will say "use dynamic imports in a try/catch to check it a package exists". Those folks are assuming you're on the backend because no frontend bundlers have no affordance for this. They'll fail when you try to bundle a dependency that isn't installed. Obviuosly it doesn't matter if you're inside a try/catch during a build step. Also: since we're talking about multiple versions of the same library, you'd need to use npm aliases to differentiate the two versions in your `package.json`. Versions of npm as recent as v10 cannot handle the combination of peer dependencies + npm aliases.

4. `zod-compat`. This extremely hand-wavy solution you see online is "define interfaces for each version that represents some basic functionality". Basically some utility types libraries can use to approximate the real deal. This is error prone, a ton of work, needs to be kept synchronized with the real implementations, and ultimately libraries are developing against a shadow version of your library that probably lacks detail. It also only works for types: if a library depends on any runtime code in Zod it falls apart.

Hence, subpaths.
