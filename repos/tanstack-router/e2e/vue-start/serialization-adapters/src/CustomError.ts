import { createSerializationAdapter } from '@tanstack/vue-router'

export class CustomError extends Error {
  public foo: string
  public bar: bigint

  constructor(message: string, options: { foo: string; bar: bigint }) {
    super(message)

    Object.setPrototypeOf(this, new.target.prototype)

    this.name = this.constructor.name
    this.foo = options.foo
    this.bar = options.bar
  }
}

export const customErrorAdapter = createSerializationAdapter({
  key: 'custom-error',
  test: (v) => v instanceof CustomError,
  toSerializable: ({ message, foo, bar }) => {
    return {
      message,
      foo,
      bar,
    }
  },
  fromSerializable: ({ message, foo, bar }) => {
    return new CustomError(message, { foo, bar })
  },
})
