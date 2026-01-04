import React, { useState, useLayoutEffect, Component } from 'react';
import { storiesOf } from '@storybook/react';

const FunctionHOC = Component => {
    const funName = props => <Component name="abc" attr={props.attr} />;
    funName.displayName = 'HOC rename';
    return funName;
};

const MyComponent = props => (
    <div className="fesf">
        {props.name} + {props.attr}
    </div>
);

const WithDisplayName = FunctionHOC(MyComponent);

export { WithDisplayName };
