import { execa } from "execa";

const $ = execa({ stdout: "inherit", stderr: "inherit" });

async function run() {
  const files = process.argv[2].split(",").map((file) => import.meta.resolve(`./${file}`).replace("file://", ""));

  for (const file of files) {
    await $`pnpm tsx --conditions @zod/source ${file}`;
    // await $`pnpm tsx ${file}`;
  }
}

run();

// exit on Ctrl-C
process.on("SIGINT", () => {
  console.log("Exiting...");
  process.exit();
});
