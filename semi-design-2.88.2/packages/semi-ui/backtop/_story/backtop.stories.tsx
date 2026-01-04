import React from 'react';
import { storiesOf } from '@storybook/react';
import BackTop from '../index';

const stories = storiesOf('Backtop', module);

class Demo extends React.Component {
    target() {
        return document.querySelector('.scroll-wrapper');
    }

    render() {
        const scStyle = {
            overflow: 'scroll',
            height: '200px'
        }
        return (
            <div className='scroll-wrapper' style={scStyle}>
                <div style={{height:400, paddingTop: 200}}>
                    <span>Scroll down to see the bottom-right gray button.</span>
                    <BackTop target={this.target} />
                </div>
            </div>
        );
    }
}

stories.add('BackTop', () => (
    <Demo />
));