import React from 'react';
import Tree from '../index';
import Gen from './bigDataGen';

class Demo extends React.Component {
    state = {
        gData: [],
    };

    // componentWillUpdate(nextProps, nextState) {
    //   // invoked immediately before rendering with new props or state, not for initial 'render'
    //   // see componentWillReceiveProps if you need to call setState
    //   // console.log(nextState.gData === this.state.gData);
    //   if (nextState.gData === this.state.gData) {
    //     this.notReRender = true;
    //   } else {
    //     this.notReRender = false;
    //   }
    // }

    onGen = data => {
        this.setState({
            gData: data,
        });
    };

    render() {
        return (
            <div style={{ padding: '0 20px' }}>
                <Gen onGen={this.onGen} />
                {this.state.gData.length ? (
                    <Tree
                        treeData={this.state.gData}
                        filterTreeNode
                        style={{
                            height: 500,
                            display: 'flex',
                            'flexDirection': 'column',
                        }}
                        debounceWait={1200}
                        multiple
                        virtualize={{
                            height: 300,
                            itemSize: 28,
                            // height: '100%', 

                        }}
                    // onExpand={(e, {expanded, node}) => console.log('expand', e, expanded, node)}
                    // onSelect={(e, bool) => console.log('select', e, bool)}
                    // onChange={e => console.log('change', e)}
                    />
                ) : null}
            </div>
        );
    }
}

export default Demo;
