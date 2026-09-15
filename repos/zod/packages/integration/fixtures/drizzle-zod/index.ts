// This file tests that drizzle-zod works with Zod v4 without
// "Type instantiation is excessively deep and possibly infinite" errors.
// See: https://github.com/colinhacks/zod/issues/XXXX

import { pgEnum, pgTable, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import * as z from "zod";

z.string();

const labelEnum = pgEnum("label", ["a", "b"]);

export const table = pgTable("table", {
  id: serial("id").primaryKey(),
  labels: labelEnum("labels").array(),
});

// This line was causing "Type instantiation is excessively deep" before the fix
export const schema = createInsertSchema(table);
