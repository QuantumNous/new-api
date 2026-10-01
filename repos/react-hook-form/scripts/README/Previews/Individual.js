import { toProfile, toAvatar } from 'Link';

export default function generate(individual) {
  const { github, avatar, alt } = individual;

  const lines = [
    `<a href = '${toProfile(github)}'>`,
    `    <img`,
    `        width = 45`,
    `        src = '${toAvatar(avatar)}'`,
    `    />`,
    `</a>`,
  ];

  if (alt) lines.slice(2, 0, `        alt = ${alt}`);

  return lines.join('\n');
}
