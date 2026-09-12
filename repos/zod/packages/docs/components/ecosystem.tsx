import { fetchStars } from "@/loaders/stars";
import type React from "react";

interface ZodResource {
  name: string;
  url: string;
  description: React.ReactNode;
  slug: string;
  stars?: number;
}

const apiLibraries: ZodResource[] = [
  {
    name: "tRPC",
    url: "https://github.com/trpc/trpc",
    description: "Build end-to-end typesafe APIs without GraphQL.",
    slug: "trpc/trpc",
  },
  {
    name: "GQLoom",
    url: "https://gqloom.dev/",
    description: "Weave GraphQL schema and resolvers using Zod.",
    slug: "modevol-com/gqloom",
  },
  {
    name: "oRPC",
    url: "https://orpc.unnoq.com/",
    description: "Typesafe APIs Made Simple",
    slug: "unnoq/orpc",
  },
  {
    name: "Express Zod API",
    url: "https://github.com/RobinTail/express-zod-api",
    description: "Build Express-based API with I/O validation and middlewares, OpenAPI docs and type-safe client.",
    slug: "RobinTail/express-zod-api",
  },
  {
    name: "nestjs-zod",
    url: "https://github.com/BenLorantfy/nestjs-zod",
    description:
      "Integrate nestjs and zod.  Create nestjs DTOs using zod, serialize with zod, and generate OpenAPI documentation from zod schemas",
    slug: "BenLorantfy/nestjs-zod",
  },
  {
    name: "Zod Sockets",
    url: "https://github.com/RobinTail/zod-sockets",
    description: "Socket.IO solution with I/O validation, an AsyncAPI generator, and a type-safe events map.",
    slug: "RobinTail/zod-sockets",
  },
  {
    name: "Zod JSON-RPC",
    url: "https://github.com/danscan/zod-jsonrpc",
    description: "Type-safe JSON-RPC 2.0 client/server library using Zod.",
    slug: "danscan/zod-jsonrpc",
  },
  {
    name: "upfetch",
    url: "https://github.com/L-Blondy/up-fetch",
    description: "Advanced fetch client builder",
    slug: "L-Blondy/up-fetch",
  },
  // https://github.com/honojs/middleware/tree/main/packages/zod-validator
  // {
  //   name: "@hono/zod-validator",
  //   url: "https://github.com/honojs/middleware/tree/main/packages/zod-validator",
  //   description: "Zod validator middleware for Hono",
  //   slug: "honojs/middleware",
  // },
];

const formIntegrations: ZodResource[] = [
  {
    name: "regle",
    url: "https://github.com/victorgarciaesgi/regle",
    description: "Headless form validation library for Vue.js.",
    slug: "victorgarciaesgi/regle",
  },
  {
    name: "conform",
    url: "https://conform.guide/api/zod/parseWithZod",
    description:
      "A type-safe form validation library utilizing web fundamentals to progressively enhance HTML Forms with full support for server frameworks like Remix and Next.js.",
    slug: "edmundhung/conform",
  },
  {
    name: "Superforms",
    url: "https://superforms.rocks",
    description: "Making SvelteKit forms a pleasure to use!",
    slug: "ciscoheat/sveltekit-superforms",
  },
  {
    name: "zod-validation-error",
    url: "https://github.com/causaly/zod-validation-error",
    description: "Generate user-friendly error messages from ZodError instances.",
    slug: "causaly/zod-validation-error",
  },
  {
    name: "svelte-jsonschema-form",
    url: "https://x0k.dev/svelte-jsonschema-form/validators/zod4/",
    description: "Svelte 5 library for creating forms based on JSON schema.",
    slug: "x0k/svelte-jsonschema-form",
  },
  {
    name: "frrm",
    url: "https://www.npmjs.com/package/frrm",
    description: "Tiny 0.5kb Zod-based, HTML form abstraction that goes brr.",
    slug: "schalkventer/frrm",
  },
  {
    name: "react-f3",
    url: "https://www.npmjs.com/package/react-f3",
    description: "Components, hooks & utilities for creating and managing delightfully simple form experiences in React.",
    slug: "maanlamp/react-f3",
  },
];

const zodToXConverters: ZodResource[] = [
  {
    name: "zod-openapi",
    url: "https://github.com/samchungy/zod-openapi",
    description: "Use Zod Schemas to create OpenAPI v3.x documentation",
    slug: "samchungy/zod-openapi",
  },
  {
    name: "fastify-zod-openapi",
    url: "https://github.com/samchungy/fastify-zod-openapi",
    description: "Fastify type provider, validation, serialization and @fastify/swagger support for Zod schemas",
    slug: "samchungy/fastify-zod-openapi",
  },
  {
    name: "zod2md",
    url: "https://github.com/matejchalk/zod2md",
    description: "Generate Markdown docs from Zod schemas",
    slug: "matejchalk/zod2md",
  },
  {
    name: "prisma-zod-generator",
    url: "https://github.com/omar-dulaimi/prisma-zod-generator",
    description: "Generate Zod schemas from Prisma schema with full ZodObject method support",
    slug: "omar-dulaimi/prisma-zod-generator",
  },
  {
    name: "@traversable/zod",
    url: "https://github.com/traversable/schema/tree/main/packages/zod",
    description: 'Build your own "Zod to x" library, or pick one of 25+ off-the-shelf transformers',
    slug: "traversable/schema",
  },
  {
    name: "zod-to-mongo-schema",
    url: "https://github.com/udohjeremiah/zod-to-mongo-schema",
    description: "Convert Zod schemas to MongoDB-compatible JSON Schemas effortlessly",
    slug: "udohjeremiah/zod-to-mongo-schema",
  },
  {
    name: "convex-helpers",
    url: "https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#zod-validation",
    description: "Use Zod to validate arguments and return values of Convex functions, and to create Convex database schemas",
    slug: "get-convex/convex-helpers",
  },
];

const xToZodConverters: ZodResource[] = [
  {
    name: "orval",
    url: "https://github.com/orval-labs/orval",
    description: "Generate Zod schemas from OpenAPI schemas",
    slug: "orval-labs/orval",
  },
  {
    name: "kubb",
    url: "https://github.com/kubb-labs/kubb",
    description: "The ultimate toolkit for working with APIs.",
    slug: "kubb-labs/kubb",
  },
  {
    name: "Hey API",
    url: "https://heyapi.dev/openapi-ts/plugins/zod",
    description: "OpenAPI to TypeScript codegen. Production-ready SDKs, Zod schemas, TanStack Query hooks, and 20+ plugins. Used by Vercel, OpenCode, and PayPal.",
    slug: "hey-api/openapi-ts",
  },
  {
    name: "valype",
    url: "https://github.com/yuzheng14/valype",
    description: "Typescript's type definition to runtime validator (including zod).",
    slug: "yuzheng14/valype",
  },
  {
    name: "Prisma Zod Generator",
    url: "https://github.com/omar-dulaimi/prisma-zod-generator",
    description:
      "Generates Zod schemas with input/result/pure variants, minimal/full/custom, selective emit/filtering, single/multi-file output, @zod rules, relation depth guards.",
    slug: "omar-dulaimi/prisma-zod-generator",
  },
  {
    name: "DRZL",
    url: "https://github.com/use-drzl/drzl",
    description:
      "Drizzle ORM toolkit that can generate Zod validators from schema(s), plus typed services and strongly typed routers (oRPC/tRPC/etc).",
    slug: "use-drzl/drzl",
  },
  {
    name: "convex-helpers",
    url: "https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#zod-validation",
    description: "Generate Zod schemas from Convex validators",
    slug: "get-convex/convex-helpers",
  },
  {
    name: "Hono Takibi",
    url: "https://github.com/nakita628/hono-takibi",
    description: "Hono Takibi is a code generator from OpenAPI to @hono/zod-openapi",
    slug: "nakita628/hono-takibi",
  }
];

const mockingLibraries: ZodResource[] = [
  {
    name: "zod-schema-faker",
    url: "https://github.com/soc221b/zod-schema-faker",
    description: "Generate mock data from zod schemas. Powered by @faker-js/faker and randexp.js.",
    slug: "soc221b/zod-schema-faker",
  },
  {
    name: "zocker",
    url: "https://zocker.sigrist.dev",
    description: "Generates valid, semantically meaningful data for your Zod schemas.",
    slug: "LorisSigrist/zocker",
  },
  {
    name: "@traversable/zod-test",
    url: "https://github.com/traversable/schema/tree/main/packages/zod-test",
    description:
      "Random zod schema generator built for fuzz testing; includes generators for both valid and invalid data",
    slug: "traversable/schema",
  },
];

const poweredByZodProjects: ZodResource[] = [
  {
    name: "zod-config",
    url: "https://github.com/alexmarqs/zod-config",
    description: "Load configurations across multiple sources with flexible adapters, ensuring type safety with Zod.",
    slug: "alexmarqs/zod-config",
  },
  {
    name: "Composable Functions",
    url: "https://github.com/seasonedcc/composable-functions",
    description: "Types and functions to make composition easy and safe.",
    slug: "seasonedcc/composable-functions",
  },
  {
    name: "zod-xlsx",
    url: "https://github.com/sidwebworks/zod-xlsx",
    description: "A xlsx based resource validator using Zod schemas for data imports and more",
    slug: "sidwebworks/zod-xlsx",
  },
  {
    name: "bupkis",
    url: "https://github.com/boneskull/bupkis",
    description: "Uncommonly extensible assertions for the beautiful people",
    slug: "boneskull/bupkis",
  },
  {
    name: "Fn Sphere",
    url: "https://github.com/lawvs/fn-sphere",
    description: "A Zod-first toolkit for building powerful, type-safe filter experiences across web apps.",
    slug: "lawvs/fn-sphere",
  },
  {
    name: "zodgres",
    url: "https://github.com/endel/zodgres",
    description: "Postgres.js + Zod: Database collections with static type inference and automatic migrations",
    slug: "endel/zodgres",
  },
  {
    name: "validex",
    url: "https://github.com/chiptoma/validex",
    description: "25 tree-shakeable validation rules for common fields (email, phone, password, etc.) with structured error codes, i18n, and framework adapters.",
    slug: "chiptoma/validex",
  },
  {
    name: "json-up",
    url: "https://github.com/Nano-Collective/json-up",
    description: "A fast, type-safe JSON migration tool with Zod schema validation.",
    slug: "Nano-Collective/json-up",
  },
];

const zodUtilities: ZodResource[] = [
  {
    name: "babel-plugin-zod-hoist",
    url: "https://github.com/gajus/babel-plugin-zod-hoist",
    description: "Babel plugin that optimizes Zod performance by hoisting schema definitions to the top of the file, avoiding repeated initialization overhead.",
    slug: "gajus/babel-plugin-zod-hoist",
  },
  {
    name: "eslint-plugin-import-zod",
    url: "https://github.com/samchungy/eslint-plugin-import-zod",
    description: "ESLint plugin to enforce namespace imports for Zod.",
    slug: "samchungy/eslint-plugin-import-zod",
  },
  {
    name: "zod-playground",
    url: "https://github.com/marilari88/zod-playground",
    description: "Interactive playground for testing and exploring Zod and Zod mini schemas in real-time.",
    slug: "marilari88/zod-playground",
  },
  {
    name: "eslint-plugin-zod",
    url: "https://github.com/marcalexiei/eslint-plugin-zod",
    description: "ESLint plugin that adds custom linting rules to enforce best practices when using Zod",
    slug: "marcalexiei/eslint-plugin-zod",
  },
  {
    name: "Zod Compare",
    url: "https://github.com/lawvs/zod-compare",
    description: "A utility library for recursively comparing Zod schemas.",
    slug: "lawvs/zod-compare",
  },
  {
    name: "zod-ir",
    url: "https://github.com/Reza-kh80/zod-ir",
    description: "Comprehensive validation for Iranian data structures (National Code, Bank Cards, Sheba, Crypto, etc) with smart metadata extraction (Bank Names, Logos). Zero dependencies.",
    slug: "Reza-kh80/zod-ir",
  },
  {
    name: "Zod AOT",
    url: "https://github.com/wakita181009/zod-aot",
    description: "Compile Zod schemas into zero-overhead validation functions at build time. 2-64x faster validation with no code changes.",
    slug: "wakita181009/zod-aot",
  },
];

export {
  apiLibraries,
  formIntegrations,
  zodToXConverters,
  xToZodConverters,
  mockingLibraries,
  poweredByZodProjects,
  zodUtilities,
};

export function Table(props: { resources: ZodResource[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Stars</th>
          {/* <th>Zod 4 support</th> */}
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {props.resources.map((resource) => (
          <tr key={resource.slug}>
            <td>
              <a href={resource.url}>
                <code className="whitespace-nowrap">{resource.name}</code>
              </a>
            </td>
            <td className="whitespace-nowrap">{`⭐️ ${resource.stars ?? "—"}`}</td>
            {/* <td className="whitespace-nowrap">{`⭐️ ${resource.v4 ? "✅" : ""}`}</td> */}
            <td>{resource.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type ResourceTableProps = {
  resources: ZodResource[];
};

async function ResourceTable({ resources }: ResourceTableProps) {
  await fetchStars(resources);

  return <Table resources={resources} />;
}

export async function ApiLibraries() {
  return <ResourceTable resources={apiLibraries} />;
}

export async function FormIntegrations() {
  return <ResourceTable resources={formIntegrations} />;
}

export async function ZodToX() {
  return <ResourceTable resources={zodToXConverters} />;
}

export async function XToZod() {
  return <ResourceTable resources={xToZodConverters} />;
}

export async function MockingLibraries() {
  return <ResourceTable resources={mockingLibraries} />;
}

export async function PoweredByZod() {
  return <ResourceTable resources={poweredByZodProjects} />;
}

export async function ZodUtilities() {
  return <ResourceTable resources={zodUtilities} />;
}
