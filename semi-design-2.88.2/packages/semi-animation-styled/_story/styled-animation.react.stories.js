import React, { useState, Component, isValidElement } from 'react';
import ReactDOM from 'react-dom';
import { storiesOf } from '@storybook/react';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import '../lib/index.css';

import * as categories from '../lib/constants/types';
import All from './all';

const stories = storiesOf('semi-animation/styledAnimation-react', module);

stories.addDecorator(withKnobs);

const rectStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    padding: '20px',
    // width: '200px',
    // height: '100px',
    margin: '20px',
    marginLeft: '50px',
    borderRadius: '4px',
    fontSize: '20px',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const itemStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    color: 'white',
    borderRadius: '4px',
    padding: '10px',
    textAlign: 'center',
};

const containerStyle = { display: 'flex', width: '960px', flexWrap: 'wrap' };

Object.keys(categories).forEach(cate => {
    stories.add(cate, () => (
        <div style={containerStyle}>
            {categories[cate].map(type => (
                <div
                    key={type}
                    className={`semi-${type} semi-animated semi-duration-slow semi-count-infinite`}
                    style={rectStyle}
                >
                    {type}
                </div>
            ))}
        </div>
    ));
});

stories.add('all styled animations', () => <All />);
