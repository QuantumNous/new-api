import * as z from "zod/mini"

z.config(z.locales.en());

z.string().parse(12);
