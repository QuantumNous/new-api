import React from 'react';
import { storiesOf } from '@storybook/react';
import Pagination from '../index';

const stories = storiesOf('Pagination', module);

stories.add('Paginationdefault', () => (
    <>
        <Pagination total={200} />
    </>
));
