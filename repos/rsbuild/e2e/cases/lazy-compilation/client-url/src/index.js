document.querySelector('#root').innerHTML = `
  <button id="load" type="button">load</button>
  <div id="result">initial</div>
`;

document.querySelector('#load').addEventListener('click', async () => {
  const { value } = await import('./lazy');
  document.querySelector('#result').textContent = value;
});
