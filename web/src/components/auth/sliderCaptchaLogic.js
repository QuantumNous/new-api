const BG_WIDTH = 320;
const BG_HEIGHT = 104;
const PUZZLE_WIDTH = 50;
const PUZZLE_SIZE = 28;
const PUZZLE_LEFT = 8;
const MIN_TARGET_X = 84;
const MAX_TARGET_X = 232;
const MIN_TARGET_Y = 26;
const MAX_TARGET_Y = 52;
const SOLVED_TOLERANCE = 6;

const toDataUrl = (svg) => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const clampSliderPosition = (position) => {
  if (!Number.isFinite(position)) {
    return 0;
  }

  return Math.min(BG_WIDTH - PUZZLE_WIDTH, Math.max(0, position));
};

export const createSliderCaptchaChallenge = (random = Math.random) => {
  const xRange = MAX_TARGET_X - MIN_TARGET_X;
  const yRange = MAX_TARGET_Y - MIN_TARGET_Y;

  return {
    targetX: Math.round(MIN_TARGET_X + random() * xRange),
    targetY: Math.round(MIN_TARGET_Y + random() * yRange),
  };
};

export const createSliderCaptchaImages = (challenge) => {
  const holeX = challenge.targetX + PUZZLE_LEFT;
  const holeY = challenge.targetY;
  const pieceY = challenge.targetY;
  const bgSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${BG_WIDTH}" height="${BG_HEIGHT}" viewBox="0 0 ${BG_WIDTH} ${BG_HEIGHT}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#eef2ff"/>
          <stop offset="48%" stop-color="#ecfeff"/>
          <stop offset="100%" stop-color="#f8fafc"/>
        </linearGradient>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#cbd5e1" stroke-width="1" opacity="0.45"/>
        </pattern>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="${BG_WIDTH}" height="${BG_HEIGHT}" rx="10" fill="url(#bg)"/>
      <rect width="${BG_WIDTH}" height="${BG_HEIGHT}" fill="url(#grid)"/>
      <circle cx="62" cy="46" r="28" fill="#818cf8" opacity="0.18"/>
      <circle cx="254" cy="112" r="36" fill="#14b8a6" opacity="0.14"/>
      <rect x="${holeX}" y="${holeY}" width="${PUZZLE_SIZE}" height="${PUZZLE_SIZE}" rx="8" fill="#0f172a" opacity="0.22" filter="url(#shadow)"/>
      <circle cx="${holeX + PUZZLE_SIZE}" cy="${holeY + PUZZLE_SIZE / 2}" r="7" fill="#0f172a" opacity="0.22"/>
      <circle cx="${holeX + PUZZLE_SIZE / 2}" cy="${holeY}" r="7" fill="#0f172a" opacity="0.22"/>
    </svg>
  `;
  const puzzleSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${PUZZLE_WIDTH}" height="${BG_HEIGHT}" viewBox="0 0 ${PUZZLE_WIDTH} ${BG_HEIGHT}">
      <defs>
        <linearGradient id="piece" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6366f1"/>
          <stop offset="100%" stop-color="#14b8a6"/>
        </linearGradient>
        <filter id="pieceShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.25"/>
        </filter>
      </defs>
      <rect x="${PUZZLE_LEFT}" y="${pieceY}" width="${PUZZLE_SIZE}" height="${PUZZLE_SIZE}" rx="8" fill="url(#piece)" filter="url(#pieceShadow)"/>
      <circle cx="${PUZZLE_LEFT + PUZZLE_SIZE}" cy="${pieceY + PUZZLE_SIZE / 2}" r="7" fill="url(#piece)"/>
      <circle cx="${PUZZLE_LEFT + PUZZLE_SIZE / 2}" cy="${pieceY}" r="7" fill="url(#piece)"/>
      <path d="M ${PUZZLE_LEFT + 8} ${pieceY + 12} L ${PUZZLE_LEFT + 18} ${pieceY + 22} L ${PUZZLE_LEFT + 32} ${pieceY + 8}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
    </svg>
  `;

  return {
    bgUrl: toDataUrl(bgSvg),
    puzzleUrl: toDataUrl(puzzleSvg),
  };
};

export const isSliderCaptchaSolved = (
  challenge,
  position,
  tolerance = SOLVED_TOLERANCE,
) => {
  if (!challenge || !Number.isFinite(position)) {
    return false;
  }

  return Math.abs(clampSliderPosition(position) - challenge.targetX) <= tolerance;
};

export const sliderCaptchaSizes = {
  bgSize: {
    width: BG_WIDTH,
    height: BG_HEIGHT,
  },
  puzzleSize: {
    width: PUZZLE_WIDTH,
    height: BG_HEIGHT,
    left: 0,
    top: 0,
  },
};
