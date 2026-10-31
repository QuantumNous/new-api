import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import NumberFormat from 'react-number-format';
import { TextField, ThemeProvider, createMuiTheme } from '@material-ui/core';

const theme = createMuiTheme({
  palette: {
    type: 'dark',
  },
});
const defaultValues = {
  priceInCents: 1234567,
  muiPriceInCents: 1234567,
};
function App() {
  const form = useForm({ defaultValues });

  const onSubmit = (data) => {
    form.reset(defaultValues);
  };

  return (
    <ThemeProvider theme={theme}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <label htmlFor="priceInCents">Price</label>
        <label htmlFor="muiPriceInCents">Material UI Price</label>
        <Controller
          name="muiPriceInCents"
          control={form.control}
          render={(props) => <MuiCurrencyFormat {...props} />}
        />

        <input type="submit" />
        <input
          style={{ display: 'block', marginTop: 20 }}
          type="button"
          onClick={() => form.reset(defaultValues)}
          value="Custom Reset"
        />

        <pre style={{ color: '#fff', marginTop: 24 }}>
          {JSON.stringify(form.watch(), null, 2)}
        </pre>
      </form>
    </ThemeProvider>
  );
}

const MuiCurrencyFormat = (props) => {
  const { onChange, value, ...rest } = props;

  return (
    <NumberFormat
      customInput={TextField}
      {...rest}
      value={value}
      fullWidth
      thousandSeparator={true}
      decimalScale={2}
      onValueChange={(target) => {
        onChange(target.floatValue);
      }}
      isNumericString
      prefix="$ "
    />
  );
};
