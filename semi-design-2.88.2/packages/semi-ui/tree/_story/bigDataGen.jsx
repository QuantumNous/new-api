/* eslint react/no-string-refs:0 */

import React from 'react';
import PropTypes from 'prop-types';
import { Form, Button } from '../../index';

function generateData(x = 3, y = 2, z = 1, gData = []) {
    // x：每一级下的节点总数。y：每级节点里有y个节点、存在子节点。z：树的level层级数（0表示一级）
    function _loop(_level, _preKey, _tns) {
        const preKey = _preKey || '0';
        const tns = _tns || gData;

        const children = [];
        for (let i = 0; i < x; i++) {
            const key = `${preKey}-${i}`;
            tns.push({ label: `${key}-标签`, key: `${key}-key`, value: `${key}-value` });
            if (i < y) {
                children.push(key);
            }
        }
        if (_level < 0) {
            return tns;
        }
        const __level = _level - 1;
        children.forEach((key, index) => {
            tns[index].children = [];
            return _loop(__level, key, tns[index].children);
        });

        return null;
    }
    _loop(z);
    return gData;
}

function calcTotal(x = 3, y = 2, z = 1) {
    const rec = n => (n >= 0 ? x * y ** n-- + rec(n) : 0);
    return rec(z + 1);
}

class Gen extends React.Component {
    static propTypes = {
        onGen: PropTypes.func,
        // x: PropTypes.number,
        // y: PropTypes.number,
        // z: PropTypes.number,
    };

    static defaultProps = {
        onGen: () => { },
        // x: 20,
        // y: 18,
        // z: 1,
    };

    state = {
        nums: '',
    };

    componentDidMount() {
        // const vals = this.getVals();
        // this.props.onGen(generateData(vals.x, vals.y, vals.z));
    }

    onGen = (val) => {
        const { x, y, z } = this.getVals( val.x, val.y, val.z );
        this.props.onGen(generateData(x, y, z));
        const total = calcTotal(x, y, z);
        this.setState({
            nums: total,
        });
        console.log('总节点', total);
    };

    getVals(x, y, z) {
        return {
            x: parseInt(x, 10),
            y: parseInt(y, 10),
            z: parseInt(z, 10),
        };
    }

    render() {
        return (
            <div style={{ padding: '0 20px' }}>
                <h2>big data generator</h2>
                <p>节点总数：{this.state.nums}</p>
                <Form onSubmit={(values) => this.onGen(values)} labelPosition='left' style={{ width: 500 }}>
                    <Form.InputNumber field='x' label='x：每一级下的节点总数'/>
                    <Form.InputNumber field='y' label='y：每级节点里有y个节点、存在子节点'/>
                    <Form.InputNumber field='z' label='z：树的level层级数（0表示一级）'/>
                    <Button htmlType='submit'>提交</Button>
                </Form>
            </div>
        );
    }
}
export default Gen;
