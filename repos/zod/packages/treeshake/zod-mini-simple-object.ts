import * as z from "zod/mini"; // 6.57 kB

const Zod = z.object({
  email: z
    .string()
    .check(
      z.minLength(1, "Please enter your email."),
      z.email("The email address is badly formatted.")
    ),
  password: z.string()
    .check(
      z.minLength(1, "Please enter your password."),
      z.minLength(8, "Your password must have 8 characters or more.")
    ),
});


Zod.parse({});
