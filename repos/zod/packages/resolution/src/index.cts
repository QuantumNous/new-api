import * as z1 from "zod";
import z2 from "zod";
import { z as z3 } from "zod";
import * as z7 from "zod/mini";
import * as z5 from "zod/v3";
import * as z4 from "zod/v4";
import * as z8 from "zod/v4-mini";
import fr from "zod/v4/locales/fr.cjs";
import * as z6 from "zod/v4/mini";

console.log(z1.string().parse("Hello, world!"));
console.log(z2.string().parse("Hello, world!"));
console.log(z3.string().parse("Hello, world!"));
console.log(z4.string().parse("Hello, world!"));
console.log(z5.string().parse("Hello, world!"));
console.log(z6.string().parse("Hello, world!"));
console.log(z7.string().parse("Hello, world!"));
console.log(z8.string().parse("Hello, world!"));

z4.config(fr());
const schema = z4.object({
  name: z4.string(),
});
const success = JSON.stringify(schema.safeParse({ name: "John Doe" }));
if (success !== `{"success":true,"data":{"name":"John Doe"}}`) {
  throw new Error();
}

const failure = JSON.stringify(schema.safeParse({ name: 123 }));
if (
  failure !==
  '{"success":false,"error":{"name":"ZodError","message":"[\\n  {\\n    \\"expected\\": \\"string\\",\\n    \\"code\\": \\"invalid_type\\",\\n    \\"path\\": [\\n      \\"name\\"\\n    ],\\n    \\"message\\": \\"Entrée invalide : chaîne attendu, nombre reçu\\"\\n  }\\n]"}}'
) {
  throw new Error();
}

console.log("Success!");
