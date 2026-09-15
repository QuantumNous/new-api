import generators from './Generators.js';

/*
 *  Match lines starting with `~`
 */

const insert_id = /^~\S*$/gm;

const comment_unknown = (type) => `<!-- Unknown Insertion Type : '${type}' -->`;

function insert(raw) {
  const type = toType(raw);

  return generators[type]?.() ?? comment_unknown(type);
}

function toType(string) {
  return string.trim().substring(1);
}

export default function insertInto(template) {
  return template.replace(insert_id, insert);
}
