---
title: Joining Clerk as an OSS Fellow to work on Zod 4
author: Colin McDonnell
date: 2024-06-11
description: Announcing my Clerk OSS Fellowship and what's coming in Zod 4.
---

I'm thrilled to announce that I'm the inaugural recipient of [Clerk's](https://go.clerk.com/zod-clerk) OSS Fellowship! This fellowship is kind of like a "summer internship"—Clerk is paying me a full-time wage (think entry-level software engineer) to work on Zod full-time throughout summer 2024.

In the context of both my own career path and Zod's development, this is a perfect arrangement, and I'm beyond grateful that Clerk was willing to experiment with some alternative funding arrangements for OSS.

Let's look at some of the context here.

## On deck: Zod 4

The current major version of Zod (v3) was released in 2021. In terms of structure and implementation, I got a lot of things right with Zod 3. The codebase has been versatile enough to supporting 23(!) minor releases, each with new features and enhancements, with no breaking changes to the public API.

But there are a couple recurring DX papercuts that will require structural changes to address, and that will involve breaking changes. (It's worth noting upfront that most Zod users will not be affected, but a lot of the libraries in Zod's ecosystem rely on internal APIs and will need to be updated.)

- To simplify the codebase and enable easier code generation tooling, some subclasses of `ZodType` will be split or consolidated.
- To improve performance, the signature of the (quasi-)internal `_parse` method will be changed. Any user-defined subclasses of `ZodType` will need to be updated accordingly.
- To clean up autocompletion, some internal methods and properties will be made `protected`. Some current APIs will be deprecated; some deprecated APIs will be removed.
- To improve error reporting, I'll be simplifying Zod's error map system. The new system will also be more amenable to internationalization (RFC forthcoming).
- To enable `exactOptionalPropertyTypes` semantics, the logic used to determine key optionality in `ZodObject` will change. Depending on the value of `exactOptionalPropertyTypes` in your `tsconfig.json`, some inferred types may change (RFC forthcoming).
- To improve TypeScript server performance, some generic class signatures (e.g. `ZodUnion`) will be changed or simplified. Other type utilities will be re-implemented for efficiency, but may result in marginally different behavior in some contexts.

All told, Zod 4 will be a ground-up rewrite of the library with few breaking changes for typical users, dramatic speed improvements, a simpler internal structure, and a big slate of new features.

## Zod's current funding story

Zod's has [many generous donors](https://github.com/sponsors/colinhacks) and is likely one of the most well-sponsored TypeScript utility libraries of its kind. Right now, that works out to just over $2600/mo. I'm grateful for this level of support, and it far exceeds the expectations I had when I first set up my GitHub Sponsors profile.

But with much love and appreciation to all the people and companies that support Zod, that's far from replacing a full-time salary in the US.

I left Bun early this year and spent a couple months traveling, learning new things, and recovering from burnout. Starting in April, I spent about 6 weeks merging PRs and fixing issues, culminating in the release of Zod 3.23 (the final 3.x version). I've spent the last month or so spec'ing out Zod 4.

In my estimation it will take about three more months of full-time work to complete the rewrite and roll out the new release responsibly to Zod's now-massive base of users and third-party ecosystem libraries. I'm beyond excited to do all this work, but that's a long time to be without an income.

So I reached out to a few companies with an experimental proposal: an "OSS incubator" where the company would sponsor the development of Zod for 12 weeks (my timeline for the release of Zod 4). During this pre-determined window, I'd get paid some reasonable wage, and the company would be Zod's primary patron. The cost to the company is known upfront, since everything is term-limited; it's like an incubator or an internship.

## The Clerk fellowship

Much to my delight, [Colin](https://twitter.com/tweetsbycolin) from Clerk (AKA "other Colin") was enthusiastically on board. I've admired Clerk for a long time for their product, eye for developer experience, and commitment to open source. In fact, I covered them on my podcast the day they launched on HN in February 2021. They've already been sponsoring [Auth.js](https://authjs.dev) (formerly NextAuth) for some time and were immediately open to discussing the terms of a potential "fellowship".

In exchange for the support, Clerk is getting a super-charged version of the perks that Zod's other sponsors already get:

1. Diamond-tier placement in the README and the docs 💎 Big logo. Big. Huge.
2. Updating my Twitter bio for the duration of the fellowship to reflect my new position as a Clerk OSS Fellow 💅
3. Mentions in the forthcoming Zod 4 RFCs (Requests for Comment). Historically Zod's RFCs have attracted a lot of attention and feedback from the TypeScript community (or at least TypeScript Twitter). This is a perfect place to shout out the company that is (effectively) paying me to implement these new features.
4. A small ad at the bottom of the sidebar of Zod's new docs site (under construction now). You can see what this might look like in the [Auth.js](https://authjs.dev/getting-started) docs.
5. For continuity after the release of Zod 4, Clerk gets "first dibs" (right of first refusal) on a new ongoing "diamond tier" sponsor slot for 6 months. The idea is that this is an exclusive "slot"—only one company can hold it at a time.The perks of this tier include the big README logo and the sidebar ad placement.
6. This announcement post! Yes, you've been reading marketing material this whole time. Gotcha.

## OSS, funding models, and trying new things

This model represents an interesting middle ground between the traditional sponsorship model and the "maintainer-in-residence" approach that companies like Vercel have taken with Rich Harris/Svelte. Zod doesn't need a full-time maintainer in perpetuity (actually, I wouldn't mind that... 🙄) but it does need full-time attention to get this major version out the door.

This fellowship is a way to bridge that gap. All-in-all, I'm beyond excited to have found a partner in Clerk that is interested in trying something like this.

> I encourage other companies to try similar things! There is no shortage of invaluable libraries with full-time (or nearly full-time) maintainers who are forgoing a regular income to build free tools. ArkType, Valibot, and tRPC come to mind.

So if you're building an app sometime soon, be smart—validate your `Request` bodies (or, uh, Server Action arguments?) and don't roll your own auth.


