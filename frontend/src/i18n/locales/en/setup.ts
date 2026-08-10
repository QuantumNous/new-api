export default {
  setup: {
    eyebrow: 'FIRST RUN / SYSTEM SETUP',
    title: 'Prepare your Ren2Hub workspace',
    intro: 'Complete these four checks before the first sign-in.',
    loading: 'Checking initialization status...',
    loadingDescription: 'Connecting to the setup service.',
    errorLabel: 'SETUP SERVICE UNAVAILABLE',
    errorTitle: 'We could not check initialization',
    errorDescription:
      'The setup status is unavailable. Retry when the backend is reachable.',
    retry: 'Retry setup check',
    database: 'Database check',
    databaseDescription: 'Review the database selected by the server.',
    administrator: 'Administrator account',
    administratorDescription:
      'Create the first root account or reuse the existing one.',
    usage: 'Usage mode',
    usageDescription: 'Choose the operating posture for this installation.',
    progress: 'Setup progress',
    review: 'Review & initialize',
    reviewDescription: 'Confirm the choices and finish the first-run setup.',
    detectedDatabase: 'Detected database',
    unknownDatabase: 'Unknown database driver',
    sqlite: 'SQLite',
    mysql: 'MySQL',
    postgres: 'PostgreSQL',
    sqliteHint:
      'SQLite stores data in one file. Persist and back up that file when running in containers.',
    mysqlHint:
      'MySQL is ready for production workloads. Keep credentials protected and maintain automated backups.',
    postgresHint:
      'PostgreSQL provides strong reliability. Review maintenance windows and retention policies.',
    unknownHint:
      'The server reported an unrecognized driver. Continue with the configured backend and confirm its maintenance plan.',
    rootExists:
      'An administrator account already exists. Existing credentials will be reused.',
    username: 'Administrator username',
    usernamePlaceholder: 'Up to 12 characters',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    confirmPassword: 'Confirm password',
    confirmPasswordPlaceholder: 'Repeat the password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    usernameRequired: 'Enter an administrator username.',
    usernameTooLong: 'Username must be 12 characters or fewer.',
    passwordTooShort: 'Password must be at least 8 characters.',
    passwordsMismatch: 'Passwords do not match.',
    chooseMode: 'How will you use Ren2Hub?',
    external: 'External operations',
    externalDescription:
      'Serve multiple users or teams with billing and quota controls.',
    self: 'Personal use',
    selfDescription:
      'Keep the installation focused on one tenant and hide billing options.',
    demo: 'Demo site',
    demoDescription:
      'Showcase the core experience with a limited, presentation-friendly setup.',
    reviewIntro:
      'Check the configuration below. Passwords are never shown here.',
    administratorReuse: 'Existing administrator will be reused',
    administratorCreate: 'Create administrator: {username}',
    notSet: 'Not set',
    mode: 'Operating mode',
    initialize: 'Initialize system',
    initializing: 'Initializing...',
    next: 'Continue',
    back: 'Back',
    initialized: 'System initialized successfully.',
    submitFailed:
      'Initialization failed. Your entries were kept so you can try again.',
    home: 'Return to workspace',
  },
}
