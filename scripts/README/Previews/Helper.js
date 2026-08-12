import { toProfile, toAvatar } from 'Link';

export default function generate(helper) {
  const { github, avatar } = helper;

  const lines = [
    `<a href = '${toProfile(github)}'>`,
    `    <img`,
    `        width = 25`,
    `        src = '${toAvatar(avatar)}'`,
    `    />`,
    `</a>`,
  ];

  return lines.join('\n');
}
