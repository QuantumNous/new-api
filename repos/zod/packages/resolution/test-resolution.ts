import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildZshy() {
  console.log("🔨 Building project with zshy...");
  try {
    await execa("zshy", [], {
      cwd: __dirname,
      stdio: "inherit",
    });
    // console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error("❌ Error building project:", error);
    process.exit(1);
  }
}

async function buildTsc() {
  console.log("🔨 Building project with tsc...");
  try {
    await execa("tsc", ["--project", "tsconfig.build.json"], {
      cwd: __dirname,
      stdio: "inherit",
    });
    // console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error("❌ Error building project:", error);
    process.exit(1);
  }
}

async function testCjs() {
  console.log("🧪 Testing CommonJS build...");
  try {
    await execa("node", ["./dist/index.cjs"], {
      cwd: __dirname,
      stdio: "inherit",
    });
    console.log("✅ CommonJS test passed!");
  } catch (error) {
    console.error("❌ CommonJS test failed:", error);
    process.exit(1);
  }
}

async function testMjs() {
  console.log("🧪 Testing CommonJS build...");
  try {
    await execa("node", ["./dist/index.mjs"], {
      cwd: __dirname,
      stdio: "inherit",
    });
    console.log("✅ CommonJS test passed!");
  } catch (error) {
    console.error("❌ CommonJS test failed:", error);
    process.exit(1);
  }
}

async function testJs() {
  console.log("🧪 Testing ES Module build...");
  try {
    await execa("node", ["./dist/index.js"], {
      cwd: __dirname,
      stdio: "inherit",
    });
    console.log("✅ ES Module test passed!");
  } catch (error) {
    console.error("❌ ES Module test failed:", error);
    process.exit(1);
  }
}

async function runAllTests() {
  console.log("🚀 Starting comprehensive resolution tests...\n");

  try {
    await buildZshy();
    await testCjs();
    await testJs();

    await buildTsc();
    await testMjs();
    await testCjs();

    console.log("🎉 All tests passed successfully!");
  } catch (error) {
    console.error("💥 Test suite failed:", error);
    process.exit(1);
  }
}

// Run the test suite
runAllTests();
