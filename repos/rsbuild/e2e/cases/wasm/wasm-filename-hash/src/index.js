const wasmPath = new URL('./factorial.wasm', import.meta.url).pathname;

document.querySelector('#root').innerHTML = wasmPath;
