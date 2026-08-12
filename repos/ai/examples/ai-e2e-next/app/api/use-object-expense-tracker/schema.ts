import type { DeepPartial } from 'ai';
import { z } from 'zod';

export const expenseSchema = z.object({
  expense: z.object({
    category: z
      .string()
      .describe(
        'Category of the expense. Allowed categories: TRAVEL, MEALS, ENTERTAINMENT, OFFICE SUPPLIES, OTHER.',
      ),
    amount: z.number().describe('Amount of the expense in USD.'),
    date: z
      .string()
      .describe('Date of the expense. Format yyyy-mmm-dd, e.g. 1952-Feb-19.'),
    details: z.string().describe('Details of the expense.'),
  }),
});

export type Expense = z.infer<typeof expenseSchema>['expense'];

export type PartialExpense = DeepPartial<Expense>;
