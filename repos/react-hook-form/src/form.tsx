import React from 'react';

import { flatten } from './utils/flatten';
import type { FieldValues, FormProps } from './types';
import { useFormContext } from './useFormContext';

const POST_REQUEST = 'post';

/**
 * Form component to manage submission.
 *
 * @param props - to setup submission detail. {@link FormProps}
 *
 * @returns form component or headless render prop.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { control, formState: { errors } } = useForm();
 *
 *   return (
 *     <Form action="/api" control={control}>
 *       <input {...register("name")} />
 *       <p>{errors?.root?.server && 'Server error'}</p>
 *       <button>Submit</button>
 *     </Form>
 *   );
 * }
 * ```
 */
function Form<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>(props: FormProps<TFieldValues, TTransformedValues>) {
  const methods = useFormContext<TFieldValues, any, TTransformedValues>();
  const [mounted, setMounted] = React.useState(false);
  const {
    control = methods.control,
    onSubmit,
    children,
    action,
    method = POST_REQUEST,
    headers,
    encType,
    onError,
    render,
    onSuccess,
    validateStatus,
    ...rest
  } = props;

  const submit = React.useCallback(
    async (event?: React.BaseSyntheticEvent) => {
      let hasError = false;
      let type = '';

      await control.handleSubmit(async (data) => {
        const formData = new FormData();
        let formDataJson = '';

        try {
          formDataJson = JSON.stringify(data);
        } catch {}

        const flattenFormValues = flatten(data as FieldValues);

        for (const key in flattenFormValues) {
          formData.append(key, flattenFormValues[key]);
        }

        if (onSubmit) {
          await onSubmit({
            data,
            event,
            method,
            formData,
            formDataJson,
          });
        }

        if (action) {
          try {
            const shouldStringifySubmissionData = [
              headers && headers['Content-Type'],
              encType,
            ].some((value) => value && value.includes('json'));

            const response = await fetch(String(action), {
              method,
              headers: {
                ...headers,
                ...(encType && encType !== 'multipart/form-data'
                  ? { 'Content-Type': encType }
                  : {}),
              },
              body: shouldStringifySubmissionData ? formDataJson : formData,
            });

            if (
              response &&
              (validateStatus
                ? !validateStatus(response.status)
                : response.status < 200 || response.status >= 300)
            ) {
              hasError = true;
              onError && onError({ response });
              type = String(response.status);
            } else {
              onSuccess && onSuccess({ response });
            }
          } catch (error: unknown) {
            hasError = true;
            onError && onError({ error });
          }
        }
      })(event);

      if (hasError && control) {
        control._subjects.state.next({
          isSubmitSuccessful: false,
        });
        control.setError('root.server', {
          type,
        });
      }
    },
    [
      control,
      onSubmit,
      method,
      action,
      headers,
      encType,
      validateStatus,
      onError,
      onSuccess,
    ],
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return render ? (
    <>
      {render({
        submit,
      })}
    </>
  ) : (
    <form
      noValidate={mounted}
      action={action}
      method={method}
      encType={encType}
      onSubmit={submit}
      {...rest}
    >
      {children}
    </form>
  );
}

export { Form };
