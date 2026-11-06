import { initPlayer } from './pages';
import { CONTAINER_HEIGHT, CONTAINER_WIDTH } from './pages/constant';
import { data } from './data';

const container = document.getElementById('container')!;

const resize = () => {
  const scale = window.innerHeight / CONTAINER_HEIGHT - 0.05;
  container.style.scale = `${scale}`;
  container.style.transformOrigin = 'top left';
  container.style.top = `${window.innerHeight / 2 - (CONTAINER_HEIGHT * scale) / 2}px`;
  container.style.left = `${window.innerWidth / 2 - (CONTAINER_WIDTH * scale) / 2}px`;
};

resize();
window.addEventListener('resize', resize);

const player = initPlayer(container, data);
player.play();

// eslint-disable-next-line no-console
console.log(player);
