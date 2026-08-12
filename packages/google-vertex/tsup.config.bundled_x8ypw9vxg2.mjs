// tsup.config.ts
import { defineConfig } from "tsup";
var tsup_config_default = defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist"
  },
  {
    entry: ["src/edge/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist/edge"
  },
  {
    entry: ["src/anthropic/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist/anthropic"
  },
  {
    entry: ["src/anthropic/edge/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist/anthropic/edge"
  }
]);
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL2xhcnNncmFtbWVsL3JlcG9zaXRvcmllcy9haS9wYWNrYWdlcy9nb29nbGUtdmVydGV4L3RzdXAuY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9sYXJzZ3JhbW1lbC9yZXBvc2l0b3JpZXMvYWkvcGFja2FnZXMvZ29vZ2xlLXZlcnRleFwiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvbGFyc2dyYW1tZWwvcmVwb3NpdG9yaWVzL2FpL3BhY2thZ2VzL2dvb2dsZS12ZXJ0ZXgvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd0c3VwJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKFtcbiAge1xuICAgIGVudHJ5OiBbJ3NyYy9pbmRleC50cyddLFxuICAgIGZvcm1hdDogWydjanMnLCAnZXNtJ10sXG4gICAgZHRzOiB0cnVlLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgfSxcbiAge1xuICAgIGVudHJ5OiBbJ3NyYy9lZGdlL2luZGV4LnRzJ10sXG4gICAgZm9ybWF0OiBbJ2NqcycsICdlc20nXSxcbiAgICBkdHM6IHRydWUsXG4gICAgc291cmNlbWFwOiB0cnVlLFxuICAgIG91dERpcjogJ2Rpc3QvZWRnZScsXG4gIH0sXG4gIHtcbiAgICBlbnRyeTogWydzcmMvYW50aHJvcGljL2luZGV4LnRzJ10sXG4gICAgZm9ybWF0OiBbJ2NqcycsICdlc20nXSxcbiAgICBkdHM6IHRydWUsXG4gICAgc291cmNlbWFwOiB0cnVlLFxuICAgIG91dERpcjogJ2Rpc3QvYW50aHJvcGljJyxcbiAgfSxcbiAge1xuICAgIGVudHJ5OiBbJ3NyYy9hbnRocm9waWMvZWRnZS9pbmRleC50cyddLFxuICAgIGZvcm1hdDogWydjanMnLCAnZXNtJ10sXG4gICAgZHRzOiB0cnVlLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICBvdXREaXI6ICdkaXN0L2FudGhyb3BpYy9lZGdlJyxcbiAgfSxcbl0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VCxTQUFTLG9CQUFvQjtBQUV0VixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQjtBQUFBLElBQ0UsT0FBTyxDQUFDLGNBQWM7QUFBQSxJQUN0QixRQUFRLENBQUMsT0FBTyxLQUFLO0FBQUEsSUFDckIsS0FBSztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1gsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBO0FBQUEsSUFDRSxPQUFPLENBQUMsbUJBQW1CO0FBQUEsSUFDM0IsUUFBUSxDQUFDLE9BQU8sS0FBSztBQUFBLElBQ3JCLEtBQUs7QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQTtBQUFBLElBQ0UsT0FBTyxDQUFDLHdCQUF3QjtBQUFBLElBQ2hDLFFBQVEsQ0FBQyxPQUFPLEtBQUs7QUFBQSxJQUNyQixLQUFLO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxRQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE9BQU8sQ0FBQyw2QkFBNkI7QUFBQSxJQUNyQyxRQUFRLENBQUMsT0FBTyxLQUFLO0FBQUEsSUFDckIsS0FBSztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1gsUUFBUTtBQUFBLEVBQ1Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
