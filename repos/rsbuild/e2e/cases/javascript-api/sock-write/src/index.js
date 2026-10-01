const button = document.createElement('button');

let count = 0;

button.id = 'button';
button.textContent = `count: ${count}`;
button.addEventListener('click', () => {
  count += 1;
  button.textContent = `count: ${count}`;
});

document.body.appendChild(button);
