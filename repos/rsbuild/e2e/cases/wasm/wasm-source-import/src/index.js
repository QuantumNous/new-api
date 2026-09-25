import source wasmModule from './factorial.wasm';

async function main() {
  const instance = await WebAssembly.instantiate(wasmModule);
  const factorial = instance.exports._Z4facti;

  document.querySelector('#root').innerHTML = [
    wasmModule instanceof WebAssembly.Module,
    factorial(3),
  ].join(',');
}

main();
