# App for cypress automation
## What?
This app is used by cypress for e2e testing purpose

## Why?
We simply want to test each react-hook-form functionality in a separated environment.
The current app folder is used for this purpose.

## How?
Each react-hook-form functionality (ex. formState, reset, useFieldArray) that we want to test is rendered at specific route (see app.tsx)
Cypress uses those routes for testing (you could navigate those routes for manual testing: http://localhost:3000/).
## How can be used:

```
  1. npm i && npm run dev
``` 

