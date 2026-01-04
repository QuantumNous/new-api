import PropTypes from 'prop-types';
import Input from '@douyinfe/semi-ui/input/index';
import React, { useRef, useState, useEffect } from 'react';
import { cssClasses } from '@douyinfe/semi-foundation/collapsible/constants';

// const Search = props => {
//     const { name } = props;
//     React.useEffect(() => {
//         console.log('calling use effect')
//     }, []);

//     return (
//         <Input placeholder={name} />
//     )
// }

// export default Search;

export default class Search extends React.Component {
    componentDidMount() {
        console.log('mounting', this.props.name);
    }

    componentDidUpdate() {
        console.log('update', this.props.name);
    }

    componentWillUnmount() {
        console.log('unmount', this.props.name);
    }

    render() {
        return (
            <Input placeholder={this.props.name} />
        );
    }
}