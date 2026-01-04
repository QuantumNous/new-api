import React from 'react';
import { Form, Tooltip, Button } from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';

/**
 * @description input, button may trigger submit of form
 * 
 * case 1: 当 form 中只有一个 input，在 input 上敲击 enter 会触发 form submit
 * case 2: 当 form 中有 2 个 input，在任意一个 input 上敲击 enter 都不会触发 form submit
 * case 3: 当 from 中有一个 input 和一个 button，在 input 上敲击 enter 会触发 form submit
 * 
 * @summary 如果不想触发 form submit，监听 input key down，如果 `e.key` 等于 `Enter` 则调用 e.preventDefault
 * 
 * @see https://github.com/DouyinFE/semi-design/issues/767#issuecomment-1098836675
 */
const App = () => {
    const { Option } = Form.Select;

    return (
        <Form
            onSubmit={() => console.log('submit')}
            onSubmitFail={(errors, values) => console.log(errors, values)}
        >
            <Form.Select field="Role" label='角色' style={{ width: 176 }}>
                <Option value="admin">管理员</Option>
                <Option value="user">普通用户</Option>
                <Option value="guest">访客</Option>
            </Form.Select>
            <Form.Input field='UserName' label='用户名' style={{ width: 80 }} onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                }
            }} />
            <Form.Input
                field='Password'
                label={{
                    text: '密码',
                    extra: <Tooltip content='详情'><IconHelpCircle style={{ color: '--semi-color-text-1' }} /></Tooltip>
                }}
                rules={[{ message: '密码长度至少为6位', validator: (_, value) => value?.length >= 6 }]}
                style={{ width: 176 }}
            />
            <Button htmlType="submit">提交</Button>
        </Form>
    );
};
App.storyName = 'form submit';

export default App;