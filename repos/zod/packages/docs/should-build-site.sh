#!/bin/bash

echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"

if [[ "$VERCEL_GIT_COMMIT_REF" == "v3" ]] ; then
  # don't build
    echo "🛑 - Build cancelled"
  exit 0;

else
  # proceed
  echo "✅ - Build can proceed"
  exit 1
fi
