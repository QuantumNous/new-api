# Package rules

The utils package is shared across multiple codebases, which may cause issues with reference equality
if different versions of the package are used in the same project. To avoid this, we should follow
these rules:

- Avoid global variables as much as possible, in particular `React.Context` instances.
- Avoid the `instanceof` operator for types defined in the utils package.
