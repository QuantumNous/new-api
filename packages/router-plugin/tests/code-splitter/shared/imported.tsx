import * as React from 'react'

export const importedComponent = () => {
  return <div>I am imported</div>
}

export const importedErrorComponent = () => {
  return <div>I am an error imported</div>
}

export const importedNotFoundComponent = () => {
  return <div>I am a not found imported</div>
}

export const importedPendingComponent = () => {
  return <div>I am a pending imported</div>
}

export const importedLoader = () => {
  return {
    randomNumber: Math.random(),
  }
}

export default function ImportedDefaultComponent() {
  return <div>Default imported</div>
}
