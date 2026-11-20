import * as z from "zod/v4"
 
// z.string().check(
//   z.minLength(5), 
//   z.maxLength(10),
//   z.refine(val => val.includes("@")),
//   z.trim()
// );

z.string().min(5).max(10).refine(val => val.includes("@")).trim().parse("asd@adsf");;
