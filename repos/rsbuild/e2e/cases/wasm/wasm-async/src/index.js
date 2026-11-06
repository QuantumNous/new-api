import('./factorial.wasm').then(({ _Z4facti: AsyncFactorial }) => {
  console.log(AsyncFactorial(1));
  console.log(AsyncFactorial(2));
  console.log(AsyncFactorial(3));
});
