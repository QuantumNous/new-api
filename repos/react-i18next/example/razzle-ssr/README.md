# Getting started

Build with [razzle](https://github.com/jaredpalmer/razzle) using its react ssr.

```bash
# npm start
```

**open:**

will detect language: [http://localhost:3000](http://localhost:3000)

german: [http://localhost:3000/?lng=de](http://localhost:3000/?lng=de)

english: [http://localhost:3000/?lng=en](http://localhost:3000/?lng=en)

## production

```bash
# npm run build
# npm run start:prod
```

## Learn more

- Uses express to also serve translations for clientside
- Translations are passed down to client on initial serverside render -> no reload of translations, no flickering
- Uses _i18next-http-middleware_ on the serverside to assert that every request gets his own instance of i18next (no race condition conflicts when user b overrides set language in i18next singleton of user a!!!)
- completely allows saveMissing feature of i18next -> added content will be pushed to server and stored in `xyz.missing.json`
