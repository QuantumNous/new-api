# Firebase Setup

1. Create a [Firebase project](https://console.firebase.google.com/)
   1. By default, firebase will configure an accepted domain for localhost...update if necessary!
2. Enable Authentication in the Firebase console
3. Add GitHub as an authentication provider:
   - Go to **Authentication** > **Sign-in method** > **GitHub**
   - Enable GitHub authentication
   - You'll need to set up OAuth in your GitHub account:
     - Go to [GitHub Developer Settings](https://github.com/settings/developers)
     - Create a new OAuth app
     - Set the homepage URL to your local or production URL
     - Set the callback URL to: `https://your-firebase-project-id.firebaseapp.com/__/auth/handler`
     - Copy the Client ID and Client Secret
   - Return to Firebase console and paste the GitHub Client ID and Client Secret
   - Save the changes

4. Create a web app in your Firebase project:
   - Go to **Project Overview** > **Add app** > **Web**
   - Register the app with a nickname
   - Copy the Firebase configuration object for later use

## Setup .env.local

Copy the .env.example provided and configure with your firebase credentials

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Run the app

To run this example:

- `npm install` or `yarn`
- `npm start` or `yarn start`
