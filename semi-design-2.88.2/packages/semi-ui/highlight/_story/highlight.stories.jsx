import React from 'react';
import ReactDOM from 'react-dom';
import { Highlight } from '../../index';

const searchWords = ['do', 'dollar'];
const sourceString = 'aaa do dollar aaa';

export default {
  title: 'Highlight'
}

export const HighlightBase = () => (
  <h2>
    <Highlight
        component='span'
        sourceString='semi design connect designOps & devOps'
        searchWords={['semi']}
        />
  </h2>
);


export const HighlightStyle = () => (
  <h2>
    <Highlight
        component='span'
        sourceString='semi design connect designOps & devOps'
        searchWords={['semi', 'design']}
        highlightStyle={{ backgroundColor: 'var(--semi-color-warning)', borderRadius: 4 }}
    />
  </h2>
);

export const HighlightClassName = () => (
  <h2>
    <Highlight
        sourceString='semi design connect designOps & devOps'
        searchWords={['semi', 'design']}
        highlightClassName='test'
        // highlightStyle={{ backgroundColor: 'var(--semi-color-warning)', borderRadius: 4 }}
    />
  </h2>
);

export const MutilpleSearchWords = () => {
  return (
      <Highlight
          component='span'
          sourceString='semi design connect designOps & devOps'
          searchWords={[
            { text: 'semi', style: { backgroundColor: 'rgba(var(--semi-teal-5), 1)', color: 'rgba(var(--semi-white), 1)', padding: 4 }, className: 'keyword1' },
            { text: 'connect', style: { backgroundColor: 'var(--semi-color-primary)', color: 'rgba(var(--semi-white), 1)', padding: 4 }, className: 'keyword2' },
            { text: 'devOps', style: { backgroundColor: 'rgba(var(--semi-violet-5), 1)', color: 'rgba(var(--semi-white), 1)', padding: 4 }, className: 'keyword3' },
          ]}
          highlightStyle={{ borderRadius: 4 }}
      />
  )
};

