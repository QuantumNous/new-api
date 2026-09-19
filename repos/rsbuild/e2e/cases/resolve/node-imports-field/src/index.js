import { message } from '#app/foo';

const app = document.createElement('div');
app.id = 'app';
app.textContent = message;

document.body.appendChild(app);
