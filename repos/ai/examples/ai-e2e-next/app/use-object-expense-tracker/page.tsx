'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import {
  expenseSchema,
  type Expense,
  type PartialExpense,
} from '../api/use-object-expense-tracker/schema';
import { useState } from 'react';

export default function Page() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const { submit, isLoading, object } = useObject({
    api: '/api/use-object-expense-tracker',
    schema: expenseSchema,
    onFinish({ object }) {
      if (object != null) {
        setExpenses(prev => [object.expense, ...prev]);
      }
    },
  });

  return (
    <div className="flex flex-col items-center min-h-screen p-4 m-4">
      <form
        className="flex items-center w-full max-w-md"
        onSubmit={e => {
          e.preventDefault();
          const input = e.currentTarget.expense as HTMLInputElement;
          if (input.value.trim()) {
            submit({ expense: input.value });
            e.currentTarget.reset();
          }
        }}
      >
        <input
          type="text"
          name="expense"
          className="flex-grow px-4 py-2 mr-2 border rounded-md"
          placeholder="Enter expense details"
        />
        <button
          type="submit"
          className="px-4 py-2 text-white bg-blue-500 rounded-md disabled:bg-blue-200 whitespace-nowrap"
          disabled={isLoading}
        >
          Log expense
        </button>
      </form>

      {isLoading && object?.expense && <ExpenseView expense={object.expense} />}

      {expenses.map((expense, index) => (
        <ExpenseView key={index} expense={expense} />
      ))}
    </div>
  );
}

const ExpenseView = ({ expense }: { expense: PartialExpense | Expense }) => (
  <div className="grid grid-cols-12 gap-4 p-4 mt-4 bg-gray-100 rounded-md dark:bg-gray-800">
    <div className="col-span-2">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {expense?.date ?? ''}
      </p>
    </div>
    <div className="col-span-2">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        ${expense?.amount?.toFixed(2) ?? ''}
      </p>
    </div>
    <div className="col-span-3">
      <p className="font-medium dark:text-white">{expense?.category ?? ''}</p>
    </div>
    <div className="col-span-5">
      <p className="text-gray-700 dark:text-gray-300">
        {expense?.details ?? ''}
      </p>
    </div>
  </div>
);
