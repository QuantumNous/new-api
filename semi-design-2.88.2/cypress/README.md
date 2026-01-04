## Name
Semi Cypress E2E(End to End) test

## Usage

Run cypress locally

```bash
yarn test:cy
```

## Directory

```
├── fixtures                # mock data
│   └── example.json
├── integration             # test cases
│   ├── *.spec.js
├── plugins                 # custom plugins
│   └── index.js
├── support                 # custom commands
│   ├── commands.js        
│   └── index.js
├── tsconfig.json           # cypress syntax
```

## Contributing

1. Write a test case in the `integration` folder;

2. Debug locally with `yarn test:cy` until the use case is passed.

## Related URLs

- [Semi Cypress Dashboard](https://dashboard.cypress.io/projects/k83u7j)
- [Writing Your First Test](https://docs.cypress.io/guides/getting-started/writing-your-first-test)

## Thanks

[![Cypress](https://www.cypress.io/static/33498b5f95008093f5f94467c61d20ab/c0bf4/cypress-logo.webp)](https://www.cypress.io)