import React, { useMemo } from 'react';
import { Table, Button } from '@douyinfe/semi-ui';

Demo.storyName = "fixed jsx column nested bug";


/**
 * fixed https://github.com/DouyinFE/semi-design/issues/619
 * 
 * Test with Cypress
 */
export default function Demo() {
    const columns = [
        {
            title: 'Base Information',
            fixed: 'left',
            children: [
                {
                    title: 'Name',
                    dataIndex: 'name',
                    width: 200,
                },
                {
                    title: 'Age',
                    dataIndex: 'age',
                    width: 100,
                },
            ],
        },
        {
            title: 'Company Information',
            children: [
                {
                    title: 'Company Name',
                    dataIndex: 'company.name',
                },
                {
                    title: 'Company Address',
                    dataIndex: 'company.address',
                },
            ],
        }
    ];

    const data = useMemo(() => {
        const data = [];
        for (let i = 0; i < 100; i++) {
            let age = (i * 1000) % 149;
            let name = `Edward King ${i}`;
            data.push({
                key: '' + i,
                company: {
                    name: 'ByteDance',
                    address: 'No. 48, Zhichun Road',
                },
                name,
                age,
                address: `No ${i + 1}, Zhongguancun Street`,
                description: `My name is ${name}, I am ${age} years old, living in No ${i + 1}, Zhongguancun Street`,
            });
        }
        return data;
    }, []);

    const [flag, setFlag] = React.useState(true);

    return (
        <>
            <Button data-cy="button" onClick={()=> setFlag(!flag)}>reRender</Button>
            <Table dataSource={data} pagination={true} size="small">
                {columns.map((item, titleIndex) =>
                    (
                        <Table.Column
                            key={titleIndex}
                            title={item.title}
                        >
                            {item.children.map(
                                (childItem, columnIndex) =>
                                    (
                                        <Table.Column
                                            title={childItem.title}
                                            dataIndex={childItem.dataIndex}
                                            key={titleIndex.toString() + columnIndex.toString()}
                                        />
                                    )
                            )}
                        </Table.Column>
                    )
                )}
                <Table.Column
                    title=""
                    key="lastColumn"
                    render={() => 123}
                />
            </Table>
        </>
    );
}