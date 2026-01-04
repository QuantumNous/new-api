import React, { useState, useMemo, useEffect } from 'react';
import { Table } from '@douyinfe/semi-ui';

function App() {
    const DAY = 24 * 60 * 60 * 1000;
    const [dataSource, setData] = useState([]);

    const getData = () => {
        const data = [];
        for (let i = 0; i < 46; i++) {
            const isSemiDesign = i % 2 === 0;
            const randomNumber = (i * 1000) % 199;
            data.push({
                key: '' + i,
                name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi Pro 设计稿${i}.fig`,
                owner: isSemiDesign ? '姜鹏志' : '郝宣',
                size: randomNumber,
                updateTime: new Date('2023-01-31').valueOf() + randomNumber * DAY,
                avatarBg: isSemiDesign ? 'grey' : 'red',
            });
        }
        return data;
    };

    useEffect(() => {
        const data = getData();
        setData(data);
    }, []);

    return (
        <div style={{ height: '250vh' }}>
            <div style={{ marginTop: 200 }}>
                <h4>top = 100 + no fixed column + no scroll</h4>
                <div>
                    <Table dataSource={dataSource} sticky={{ top: 100 }}>
                        <Table.Column title="标题" dataIndex="name" key="name" />
                        <Table.Column title="大小" dataIndex="size" key="size" />
                        <Table.Column title="所有者" dataIndex="owner" key="owner" />
                        <Table.Column title="更新时间" dataIndex="updateTime" key="updateTime" />
                        <Table.Column title="" dataIndex="operate" key="operate" />
                    </Table>
                </div>
            </div>
        </div>
    );
}

export default App;
