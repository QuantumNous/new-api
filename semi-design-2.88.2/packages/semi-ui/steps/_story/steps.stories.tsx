import React from 'react';
import { storiesOf } from '@storybook/react';
import Steps from '../index';

const Step = Steps.Step;

const stories = storiesOf('Steps', module);

stories.add('Steps default', () => (
    <>
       <Steps current={0} status="process">
           <Step status='error' description='fe'>12</Step>
           <Step status="finish" description='fe'>12</Step>
           <Step status="wait" description='fe'>12</Step>
        </Steps>
    </>
));
