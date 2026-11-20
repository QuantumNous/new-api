import * as React from 'react';
import { fetchPosts } from '../posts';
const SplitLoader = fetchPosts;
export { SplitLoader as loader };