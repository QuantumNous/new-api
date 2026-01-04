import React from 'react';
import Avatar from '../index';
import AvatarGroup from '../avatarGroup';

const Demo = () => {
    return (
        <div>
            <Avatar src="//placekitten.com/200/300"></Avatar>
            <div>
                <AvatarGroup>
                    <Avatar color='red'>LL</Avatar>
                    <Avatar >CX</Avatar>
                    <Avatar color='amber'>RM</Avatar>
                    <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
                    <Avatar style={{ backgroundColor: '#87d068' }} >YZ</Avatar>
                </AvatarGroup>
            </div>
        </div>
    );
};

export default Demo;