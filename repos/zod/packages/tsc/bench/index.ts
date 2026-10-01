import { execa } from "execa";

const $ = execa({ stdout: "inherit", stderr: "inherit" });

async function run() {
  const fileNames = process.argv[2];

  if (!fileNames) {
    console.error("Specify a benchmark name(s), e.g. `pnpm bench object-with-extend`");
    process.exit(1);
  }
  const files = fileNames.split(",").map((file) => import.meta.resolve(`./${file}`).replace("file://", ""));

  for (const file of files) {
    await $`pnpm tsx --conditions @zod/source ${file}`;
  }
}

run();

// exit on Ctrl-C
process.on("SIGINT", () => {
  console.log("Exiting...");
  process.exit();
});
