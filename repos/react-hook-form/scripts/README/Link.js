export function toProfile(username) {
  return `https://github.com/${username}`;
}

export function toAvatar(id) {
  return `https://avatars.githubusercontent.com/u/${id}`;
}

export function toLogo(path) {
  return `https://images.opencollective.com/${path}/256.png`;
}

export function toLink(path) {
  return `https://${path}`;
}
