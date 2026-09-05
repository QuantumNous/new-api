import * as z from "zod/mini"
 
z.string().check(
  z.minLength(5), 
  z.maxLength(10),
  z.refine(val => val.includes("@")),
  z.trim()
).parse("asd@adsf");
