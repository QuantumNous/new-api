import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';

let i = 0;

jest.mock('../../logic/generateId', () => () => String(i++));

describe('useFieldArray dirtyFields isolation', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should only mark items dirty when only items field array is appended', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
        },
      });
      const { fields, append } = useFieldArray({
        control,
        name: 'items',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          <input {...register('age')} />
          {fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: 'new' })}>
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/ }));

    await waitFor(() => {
      expect(dirtyResult).toEqual({
        items: [{ value: true }],
      });
      expect(dirtyResult).not.toHaveProperty('name');
      expect(dirtyResult).not.toHaveProperty('age');
    });
  });

  it('should mark both name and items dirty when both are modified', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
        },
      });
      const { fields, append } = useFieldArray({
        control,
        name: 'items',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          <input {...register('age')} />
          {fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: 'new' })}>
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getAllByRole('textbox')[0], {
      target: { value: 'Bob' },
    });

    fireEvent.click(screen.getByRole('button', { name: /append/ }));

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('name', true);
      expect(dirtyResult).toHaveProperty('items');
      expect(dirtyResult).not.toHaveProperty('age');
    });
  });

  it('should only mark items_copy dirty when only items_copy is appended (multiple field arrays)', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
        items_copy: { value: string; value2: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
          items_copy: [],
        },
      });
      const itemsArray = useFieldArray({ control, name: 'items' });
      const itemsCopyArray = useFieldArray({ control, name: 'items_copy' });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          <input {...register('age')} />
          {itemsArray.fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          {itemsCopyArray.fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`items_copy.${i}.value` as const)} />
              <input {...register(`items_copy.${i}.value2` as const)} />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              itemsCopyArray.append({ value: 'new', value2: 'new2' })
            }
          >
            appendCopy
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /appendCopy/ }));

    await waitFor(() => {
      expect(dirtyResult).toEqual({
        items_copy: [{ value: true, value2: true }],
      });
      expect(dirtyResult).not.toHaveProperty('name');
      expect(dirtyResult).not.toHaveProperty('age');
      expect(dirtyResult).not.toHaveProperty('items');
    });
  });

  it('should mark both field arrays dirty when both are appended', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
        items_copy: { value: string; value2: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
          items_copy: [],
        },
      });
      const itemsArray = useFieldArray({ control, name: 'items' });
      const itemsCopyArray = useFieldArray({ control, name: 'items_copy' });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          <input {...register('age')} />
          {itemsArray.fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          {itemsCopyArray.fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`items_copy.${i}.value` as const)} />
              <input {...register(`items_copy.${i}.value2` as const)} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => itemsArray.append({ value: 'item1' })}
          >
            appendItems
          </button>
          <button
            type="button"
            onClick={() =>
              itemsCopyArray.append({ value: 'copy1', value2: 'copy2' })
            }
          >
            appendCopy
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /appendItems/ }));
    fireEvent.click(screen.getByRole('button', { name: /appendCopy/ }));

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('items');
      expect(dirtyResult).toHaveProperty('items_copy');
      expect(dirtyResult).not.toHaveProperty('name');
      expect(dirtyResult).not.toHaveProperty('age');
    });
  });

  it('should mark name and items_copy dirty when both are modified, leaving age and items clean', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
        items_copy: { value: string; value2: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
          items_copy: [],
        },
      });
      const itemsArray = useFieldArray({ control, name: 'items' });
      const itemsCopyArray = useFieldArray({ control, name: 'items_copy' });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} data-testid="name" />
          <input {...register('age')} />
          {itemsArray.fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          {itemsCopyArray.fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`items_copy.${i}.value` as const)} />
              <input {...register(`items_copy.${i}.value2` as const)} />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              itemsCopyArray.append({ value: 'copy1', value2: 'copy2' })
            }
          >
            appendCopy
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByTestId('name'), {
      target: { value: 'Alice' },
    });

    fireEvent.click(screen.getByRole('button', { name: /appendCopy/ }));

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('name', true);
      expect(dirtyResult).toHaveProperty('items_copy');
      expect(dirtyResult).not.toHaveProperty('age');
      expect(dirtyResult).not.toHaveProperty('items');
    });
  });

  it('should not mark unrelated fields dirty with nested field array path', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        nonusservices: {
          VATFiling_list: { id: string; value: string }[];
        };
      }>({
        defaultValues: {
          name: 'John Doe',
          age: 30,
          nonusservices: {
            VATFiling_list: [{ id: '1', value: 'Item 1' }],
          },
        },
      });
      const { fields, append } = useFieldArray({
        control,
        name: 'nonusservices.VATFiling_list',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          <input {...register('age')} />
          {fields.map((field, i) => (
            <div key={field.id}>
              <input
                {...register(`nonusservices.VATFiling_list.${i}.id` as const)}
              />
              <input
                {...register(
                  `nonusservices.VATFiling_list.${i}.value` as const,
                )}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ id: '2', value: 'Item 2' })}
          >
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/ }));

    await waitFor(() => {
      expect(dirtyResult).not.toHaveProperty('name');
      expect(dirtyResult).not.toHaveProperty('age');
      expect(dirtyResult).toHaveProperty('nonusservices');
    });
  });

  it('should not mark unrelated fields dirty after remove operation', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        title: string;
        description: string;
        tags: { label: string }[];
      }>({
        defaultValues: {
          title: 'My Post',
          description: 'Some description',
          tags: [{ label: 'react' }, { label: 'typescript' }],
        },
      });
      const { fields, remove } = useFieldArray({
        control,
        name: 'tags',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('title')} />
          <input {...register('description')} />
          {fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`tags.${i}.label` as const)} />
              <button type="button" onClick={() => remove(i)}>
                remove{i}
              </button>
            </div>
          ))}
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /remove0/ }));

    await waitFor(() => {
      expect(dirtyResult).not.toHaveProperty('title');
      expect(dirtyResult).not.toHaveProperty('description');
      expect(dirtyResult).toHaveProperty('tags');
    });
  });

  it('should preserve name dirty state after append then remove reverts array', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        items: { value: string }[];
      }>({
        defaultValues: {
          name: 'John',
          items: [{ value: 'original' }],
        },
      });
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} data-testid="name" />
          {fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: 'new' })}>
            append
          </button>
          <button type="button" onClick={() => remove(fields.length - 1)}>
            removeLast
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByTestId('name'), {
      target: { value: 'Changed' },
    });

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('name', true);
    });

    fireEvent.click(screen.getByRole('button', { name: /append/ }));

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('name', true);
      expect(dirtyResult).toHaveProperty('items');
    });

    fireEvent.click(screen.getByRole('button', { name: /removeLast/ }));

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('name', true);
    });
  });

  it('should not pollute unrelated fields after multiple appends', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        email: string;
        phone: string;
        addresses: { street: string; city: string }[];
      }>({
        defaultValues: {
          email: 'john@example.com',
          phone: '123-456',
          addresses: [],
        },
      });
      const { fields, append } = useFieldArray({
        control,
        name: 'addresses',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('email')} />
          <input {...register('phone')} />
          {fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`addresses.${i}.street` as const)} />
              <input {...register(`addresses.${i}.city` as const)} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ street: '', city: '' })}
          >
            addAddress
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /addAddress/ }));
    fireEvent.click(screen.getByRole('button', { name: /addAddress/ }));
    fireEvent.click(screen.getByRole('button', { name: /addAddress/ }));

    await waitFor(() => {
      expect(dirtyResult).not.toHaveProperty('email');
      expect(dirtyResult).not.toHaveProperty('phone');
      expect(dirtyResult).toHaveProperty('addresses');
      expect((dirtyResult as any).addresses).toHaveLength(3);
    });
  });

  it('should isolate dirty state in large forms with many fields', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        company: string;
        todos: { task: string }[];
      }>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          phone: '555-1234',
          company: 'Acme',
          todos: [],
        },
      });
      const { fields, append } = useFieldArray({
        control,
        name: 'todos',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('firstName')} />
          <input {...register('lastName')} />
          <input {...register('email')} />
          <input {...register('phone')} />
          <input {...register('company')} />
          {fields.map((field, i) => (
            <input key={field.id} {...register(`todos.${i}.task` as const)} />
          ))}
          <button type="button" onClick={() => append({ task: 'New todo' })}>
            addTodo
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /addTodo/ }));

    await waitFor(() => {
      expect(dirtyResult).not.toHaveProperty('firstName');
      expect(dirtyResult).not.toHaveProperty('lastName');
      expect(dirtyResult).not.toHaveProperty('email');
      expect(dirtyResult).not.toHaveProperty('phone');
      expect(dirtyResult).not.toHaveProperty('company');
      expect(dirtyResult).toHaveProperty('todos');
    });
  });

  it('should only update root branch when nested useFieldArray with indexed name is appended', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        title: string;
        test: {
          firstName: string;
          lastName: string;
          keyValue: { name: string }[];
        }[];
      }>({
        defaultValues: {
          title: 'My Form',
          test: [
            {
              firstName: 'Bill',
              lastName: 'Luo',
              keyValue: [{ name: '1a' }],
            },
          ],
        },
      });
      const { fields: testFields } = useFieldArray({
        control,
        name: 'test',
      });
      const {
        fields: keyValueFields,
        append,
        remove,
      } = useFieldArray({
        control,
        name: 'test.0.keyValue',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('title')} />
          {testFields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`test.${i}.firstName` as const)} />
              <input {...register(`test.${i}.lastName` as const)} />
            </div>
          ))}
          {keyValueFields.map((field, i) => (
            <input
              key={field.id}
              {...register(`test.0.keyValue.${i}.name` as const)}
            />
          ))}
          <button type="button" onClick={() => append({ name: 'new' })}>
            nestAppend
          </button>
          <button
            type="button"
            onClick={() => remove(keyValueFields.length - 1)}
          >
            nestRemove
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /nestAppend/ }));

    await waitFor(() => {
      expect(dirtyResult).not.toHaveProperty('title');
      expect(dirtyResult).toHaveProperty('test');
      const testArray = (dirtyResult as any).test;
      expect(testArray[0]).toHaveProperty('keyValue');
      expect(testArray[0].keyValue).toEqual([undefined, { name: true }]);
    });

    fireEvent.click(screen.getByRole('button', { name: /nestRemove/ }));

    await waitFor(() => {
      expect(dirtyResult).not.toHaveProperty('title');
    });
  });

  it('should not mark unrelated fields dirty when using setValue with shouldDirty on a field array', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        setValue,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
        },
      });
      const { fields } = useFieldArray({
        control,
        name: 'items',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          <input {...register('age')} />
          {fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() =>
              setValue('items', [{ value: 'new' }], { shouldDirty: true })
            }
          >
            setItems
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /setItems/ }));

    await waitFor(() => {
      expect(dirtyResult).toEqual({
        items: [{ value: true }],
      });
      expect(dirtyResult).not.toHaveProperty('name');
      expect(dirtyResult).not.toHaveProperty('age');
    });
  });

  it('should preserve other dirty fields when using setValue with shouldDirty on a field array', async () => {
    let dirtyResult = {};
    const Component = () => {
      const {
        register,
        control,
        setValue,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
        },
      });
      const { fields } = useFieldArray({
        control,
        name: 'items',
      });

      dirtyResult = dirtyFields;

      return (
        <form>
          <input {...register('name')} data-testid="name" />
          <input {...register('age')} />
          {fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() =>
              setValue('items', [{ value: 'new' }], { shouldDirty: true })
            }
          >
            setItems
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByTestId('name'), {
      target: { value: 'Changed' },
    });

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('name', true);
    });

    fireEvent.click(screen.getByRole('button', { name: /setItems/ }));

    await waitFor(() => {
      expect(dirtyResult).toHaveProperty('name', true);
      expect(dirtyResult).toHaveProperty('items');
      expect(dirtyResult).not.toHaveProperty('age');
    });
  });

  it('should revalidate dirty fields when dirty flag is not match field level dirty', async () => {
    function App() {
      const { register, handleSubmit, formState, setValue } = useForm({
        defaultValues: {
          firstName: '',
          lastName: '',
        },
      });

      return (
        <div>
          <form onSubmit={handleSubmit(() => {})}>
            <div>Dirty Fields:</div>
            {Object.keys(formState.dirtyFields ?? {}).map((field) => (
              <div key={field}>{field}</div>
            ))}
            <div>isDirty: {String(formState.isDirty)}</div>

            <button
              type="button"
              onClick={() =>
                setValue('firstName', 'temp', { shouldDirty: false })
              }
            >
              Set First Name
            </button>

            <input {...register('firstName')} placeholder="First Name" />
            <input {...register('lastName')} placeholder="Last Name" />

            <input type="submit" />
          </form>
        </div>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /set first name/i }));

    const lastNameInput = screen.getByPlaceholderText(/last name/i);
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });

    await waitFor(() => {
      expect(screen.getByText('lastName')).toBeInTheDocument();
    });

    fireEvent.change(lastNameInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText('lastName')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/isDirty:/i)).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.queryByText('firstName')).toBeInTheDocument();
    });
  });
});
