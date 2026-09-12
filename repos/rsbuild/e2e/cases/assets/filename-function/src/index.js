import './index.css';
import circle from '@e2e/assets/circle.svg?url';
import icon from '@e2e/assets/icon.png?url';
import image from '@e2e/assets/image.png?url';
import mobile from '@e2e/assets/mobile.svg?url';

console.log(icon, image, circle, mobile);

import(/* rspackChunkName: "foo" */ './async');
