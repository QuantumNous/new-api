import './graphic.js';
import { registerPainter } from '../zrender.js';
import Painter from './Painter.js';
registerPainter('vml', Painter);
