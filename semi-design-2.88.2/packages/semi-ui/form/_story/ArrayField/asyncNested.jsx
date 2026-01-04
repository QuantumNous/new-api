import { IconPlusCircle } from "@douyinfe/semi-icons";
import { ArrayField, Button, Card, Form } from "@douyinfe/semi-ui";
import React, { useEffect, useState } from "react";

const AsyncComponent = ({ field }) => {
    const [done, setDone] = useState(false);
    useEffect(() => {
        setTimeout(() => {
            setDone(true);
        }, 10);
    }, []);
    const ret = done ? (
        <Form.Input
            field={field}
            style={{ width: 100, marginRight: 12 }}
        ></Form.Input>
    ) : null;
    return <>{ret} 这里是异步组件</>;
};

const NestedField = (props) => {
    const rowStyle = {
        marginTop: 12,
        marginLeft: 12,
    };
    return (
        <Form.Slot label="内层">
            <ArrayField field={`${props.field}.rules`}>
                {({ add, arrayFields }) => (
                    <React.Fragment>
                        {arrayFields.map(({ field, key }) => (
                            <div style={{ display: "flex" }} key={key}>
                                <AsyncComponent field={`${field}[itemName]`} />
                            </div>
                        ))}
                        <Button
                            icon={<IconPlusCircle />}
                            style={rowStyle}
                            onClick={() => {
                                return add();
                            }}
                        />
                    </React.Fragment>
                )}
            </ArrayField>
        </Form.Slot>
    );
};

const AsyncNestArrayField = () => {
    return (
        <Form labelPosition="left" style={{ textAlign: "left" }}>
            <Form.Slot label="外层">
                <ArrayField field="group">
                    {({ add, arrayFields }) => (
                        <React.Fragment>
                            <Button
                                icon={<IconPlusCircle />}
                                theme="solid"
                                onClick={() => {
                                    return add();
                                }}
                            >
                                新增收信规则
                            </Button>
                            {arrayFields.map(({ field, key, remove }, i) => (
                                <div
                                    key={key}
                                    style={{ width: 1000, display: "flex", flexWrap: "wrap" }}
                                >
                                    <Card
                                        shadow="hover"
                                        style={{
                                            width: 620,
                                            margin: "12px 0 0 24px",
                                        }}
                                    >
                                        <NestedField field={field} />
                                    </Card>
                                </div>
                            ))}
                        </React.Fragment>
                    )}
                </ArrayField>
            </Form.Slot>
        </Form>
    );
};

export default AsyncNestArrayField;