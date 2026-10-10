import { headingRank } from 'hast-util-heading-rank';
import { toString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';

// This is a fork of https://github.com/rehypejs/rehype-slug/blob/main/lib/index.js, but better

/**
 * @typedef {import('hast').Root} Root
 */

/**
 * @typedef Options
 *   Configuration (optional).
 * @property {string} [prefix='']
 *   Prefix to add in front of `id`s (default: `''`).
 */

/** @type {Options} */
const emptyOptions = {};

/**
 * Add `id`s to headings.
 *
 * @param {Options | null | undefined} [options]
 *   Configuration (optional).
 * @returns
 *   Transform.
 */
export default function rehypeSlug(options) {
  const settings = options || emptyOptions;
  const prefix = settings.prefix || '';

  /**
   * @param {Root} tree
   *   Tree.
   * @returns {undefined}
   *   Nothing.
   */
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (headingRank(node) && !node.properties.id) {
        node.properties.id = prefix + stringToUrl(toString(node));
      }
      return undefined;
    });
  };
}

/**
 * Converts a string into a well-formatted URL material, taking into account common contractions
 * `"1. Here’s a wicked example & more." => "1-here-is-a-wicked-example-and-more"`
 */
export function stringToUrl(string) {
  return string
    .replace(/([a-z])('|’|‘)ll([^a-z])/gi, '$1-will$3') // "you'll, we'll" => "you-will, we-will"
    .replace(/won('|’|‘)t([^a-z])/gi, 'will-not$2') // "won't" => "will-not"
    .replace(/can('|’|‘)t([^a-z])/gi, 'cannot$2') // "can't" => "cannot"
    .replace(/n('|’|‘)t([^a-z])/gi, '-not$2') // "don't, doesn't, wouldn't, etc" => "do-not, does-not, would-not, etc"
    .replace(/([a-z])('|’|‘)ve/gi, '$1-have') // "you've, could've" => "you-have, could-have"
    .replace(/([a-z])('|’|‘)re/gi, '$1-are') // "you're, there're" => "you-are, there-are"
    .replace(/(that|there|they)('|’|‘)d/gi, '$1-would') // "that'd" => "that-would"
    .replace(/(that|there|here)('|’|‘)s/gi, '$1-is') // "that's" => "that-is"
    .replace(/([a-z])('|’|‘)s([^a-z])/gi, '$1s$3') // "user's, client's" => "users, clients"
    .replace(/\s+|_|–|—|'|’|‘|"|“|”|\./gi, '-')
    .replace(/&/gi, '-and-')
    .replace(/[^a-z0-9-]/gi, '')
    .replace(/-+/gi, '-')
    .replace(/^-|-$/gi, '')
    .toLowerCase();
}
