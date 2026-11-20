// This fixture tests that Zod's built types have no internal errors
// when compiled with skipLibCheck: false

import { z } from "zod";

// Basic schema usage
const userSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
  email: z.string().email(),
  tags: z.array(z.string()),
  role: z.enum(["admin", "user", "guest"]),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
});

type User = z.infer<typeof userSchema>;

// Parse some data
const result = userSchema.safeParse({
  name: "Alice",
  age: 30,
  email: "alice@example.com",
  tags: ["developer"],
  role: "admin",
  metadata: { foo: "bar" },
  createdAt: new Date(),
});

if (result.success) {
  const user: User = result.data;
  console.log(user.name);
}

// Test various schema types
const complexSchema = z.union([
  z.object({ type: z.literal("a"), value: z.string() }),
  z.object({ type: z.literal("b"), value: z.number() }),
]);

const tupleSchema = z.tuple([z.string(), z.number(), z.boolean()]);
const intersectionSchema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));

// Refinements and transforms
const _refinedSchema = z.string().refine((s) => s.length > 0);
const _transformedSchema = z.string().transform((s) => s.toUpperCase());
const _pipedSchema = z.string().pipe(z.string().min(1));

// Optional/nullable
const _optionalSchema = z.object({
  required: z.string(),
  optional: z.string().optional(),
  nullable: z.string().nullable(),
  nullish: z.string().nullish(),
  withDefault: z.string().default("default"),
});

export { userSchema, complexSchema, tupleSchema, intersectionSchema };
