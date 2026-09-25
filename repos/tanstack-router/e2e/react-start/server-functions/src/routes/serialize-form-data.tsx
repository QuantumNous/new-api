import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

import { createServerFn } from '@tanstack/react-start'

export const Route = createFileRoute('/serialize-form-data')({
  component: SerializeFormDataFnCall,
})

const testValues = {
  name: 'Sean',
  age: 25,
  pet1: 'dog',
  pet2: 'cat',
  __adder: 1,
}

export const greetUser = createServerFn({ method: 'POST' })
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) {
      throw new Error('Invalid! FormData is required')
    }
    const name = data.get('name')
    const age = data.get('age')
    const pets = data.getAll('pet')

    if (!name || !age || pets.length === 0) {
      throw new Error('Name, age and pets are required')
    }

    return {
      name: name.toString(),
      age: parseInt(age.toString(), 10),
      pets: pets.map((pet) => pet.toString()),
    }
  })
  .handler(({ data: { name, age, pets } }) => {
    return `Hello, ${name}! You are ${age + testValues.__adder} years old, and your favorite pets are ${pets.join(',')}.`
  })

export function SerializeFormDataFnCall() {
  const [formDataResult, setFormDataResult] = React.useState({})

  return (
    <div className="p-2 m-2 grid gap-2">
      <h3>Serialize FormData Fn POST Call</h3>
      <div className="overflow-y-auto">
        It should return{' '}
        <code>
          <pre data-testid="expected-serialize-formdata-server-fn-result">
            Hello, {testValues.name}! You are{' '}
            {testValues.age + testValues.__adder} years old, and your favorite{' '}
            pets are {testValues.pet1},{testValues.pet2}.
          </pre>
        </code>
      </div>
      <form
        className="flex flex-col gap-2"
        data-testid="serialize-formdata-form"
        onSubmit={(evt) => {
          evt.preventDefault()
          const data = new FormData(evt.currentTarget)
          greetUser({ data }).then(setFormDataResult)
        }}
      >
        <input type="text" name="name" defaultValue={testValues.name} />
        <input type="number" name="age" defaultValue={testValues.age} />
        <input type="text" name="pet" defaultValue={testValues.pet1} />
        <input type="text" name="pet" defaultValue={testValues.pet2} />
        <button
          type="submit"
          data-testid="test-serialize-formdata-fn-calls-btn"
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Submit
        </button>
      </form>
      <div className="overflow-y-auto">
        <pre data-testid="serialize-formdata-form-response">
          {JSON.stringify(formDataResult)}
        </pre>
      </div>
    </div>
  )
}
