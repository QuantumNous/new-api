# TanStack Start + WorkOS

This site is built with TanStack Router! An example application demonstrating how to authenticate users with AuthKit and the WorkOS Node SDK.

- [TanStack Router Docs](https://tanstack.com/router)
- [WorkOS Documentation](https://workos.com/docs)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/start-workos start-workos
```

## Prerequisites

You will need a [WorkOS account](https://dashboard.workos.com/signup).

## Running the example

1. In the [WorkOS dashboard](https://dashboard.workos.com), click on the User Management tile and set up the [sign-in callback redirect](https://workos.com/docs/user-management/1-configure-your-project/configure-a-redirect-uri) as `http://localhost:3000/api/auth/callback`. Once completed, set the app homepage URL to `http://localhost:3000`.
   > [!NOTE]
   > If you already have set up an application in your WorkOS dashboard, then you can simply head to the _Redirects_ tab and add a new redirect URI.
2. After creating the redirect URI, navigate to the API keys tab and copy the _Client ID_ and the _Secret Key_. Rename the `.env.example` file to `.env` and supply your Client ID and API key as environment variables.
3. Additionally, create a cookie password as the private key used to encrypt the session cookie. Copy the output into the environment variable `WORKOS_COOKIE_PASSWORD`.
   It has to be at least 32 characters long. You can use https://1password.com/password-generator/ to generate strong passwords.
4. Verify your `.env.local` file has the following variables filled.
   ```bash
   WORKOS_CLIENT_ID=<YOUR_CLIENT_ID>
   WORKOS_API_KEY=<YOUR_API_SECRET_KEY>
   WORKOS_COOKIE_PASSWORD=<YOUR_COOKIE_PASSWORD>
   WORKOS_REDIRECT_URI=http://localhost:3000/callback
   ```
   `WORKOS_COOKIE_PASSWORD` is the private key used to encrypt the session cookie. It has to be at least 32 characters long. You can use the [1Password generator](https://1password.com/password-generator/) or the `openssl` library to generate a strong password via the command line:
   ```bash
   openssl rand -base64 24
   ```
   To use the `signOut` method, you'll need to set a default Logout URI in your WorkOS dashboard settings under "Redirects".
5. Run the following command and navigate to [http://localhost:3000](http://localhost:3000).
   ```bash
   pnpm dev
   ```

## Build

Build for production:

```sh
pnpm build
```

## About This Example

This example demonstrates:

- WorkOS authentication integration
- AuthKit usage
- Protected routes
- User session management
