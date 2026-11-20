import { initPlayer } from '.';

const player = initPlayer(document.getElementById('container')!);
player.play();

// eslint-disable-next-line no-console
console.log(player);
