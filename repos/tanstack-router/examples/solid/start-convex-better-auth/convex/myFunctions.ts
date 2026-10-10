import { v } from 'convex/values'
import { action, mutation, query } from './_generated/server'
import { api } from './_generated/api'
import { authComponent } from './auth'

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:
export const listNumbers = query({
  // Validators for arguments.
  args: {
    count: v.number(),
  },

  // Query implementation.
  handler: async (ctx, args) => {
    // Get the current authenticated user
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser._id) {
      throw new Error('User must be authenticated to list random numbers')
    }

    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const numbers = await ctx.db
      .query('numbers')
      .withIndex('userId', (q) => q.eq('userId', authUser._id))
      // Ordered by _creationTime, return most recent
      .order('desc')
      .take(args.count)
    return {
      viewer: (await ctx.auth.getUserIdentity())?.name ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    }
  },
})

// You can write data to the database via a mutation:
export const addNumber = mutation({
  // Validators for arguments.
  args: {
    value: v.number(),
  },

  // Mutation implementation.
  handler: async (ctx, args) => {
    // Get the current authenticated user
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser._id) {
      throw new Error('User must be authenticated to create a random number')
    }

    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.

    const id = await ctx.db.insert('numbers', {
      value: args.value,
      userId: authUser._id,
    })

    console.log('Added new document with id:', id)
    // Optionally, return a value from your mutation.
    // return id;
  },
})

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = action({
  // Validators for arguments.
  args: {
    first: v.number(),
  },

  // Action implementation.
  handler: async (ctx, args) => {
    // // Use the browser-like `fetch` API to send HTTP requests.
    // // See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    // const response = await ctx.fetch("https://api.thirdpartyservice.com");
    // const data = await response.json();

    // // Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    })
    console.log(data)

    // // Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    })
  },
})
