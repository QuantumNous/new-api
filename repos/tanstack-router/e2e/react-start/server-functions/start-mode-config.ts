const FUNCTION_IDS: Record<string, Record<string, string>> = {
  'src/routes/submit-post-formdata.tsx': {
    greetUser_createServerFn_handler: 'submit-post-formdata-greetUser',
  },
  'src/routes/formdata-redirect/index.tsx': {
    greetUser_createServerFn_handler: 'formdata-redirect-greetUser',
  },
}

export function getStartModeConfig() {
  return {
    serverFns: {
      generateFunctionId: (opts: {
        filename: string
        functionName: string
      }) => {
        return FUNCTION_IDS[opts.filename]?.[opts.functionName]
      },
    },
  }
}
