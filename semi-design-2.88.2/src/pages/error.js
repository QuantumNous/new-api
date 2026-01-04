import React, { useEffect } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { navigate } from 'gatsby';
import { IconHome } from '@douyinfe/semi-icons';
import SEO from '../components/seo';

const ErrorPage = ({ data }) => {
    const clickHome = () => {
        navigate('/');
    }; 

    useEffect(() => {
        console.log('enter 404');
    });
    return (
        <div className="semi-site-page">
            <SEO lang="zh-CN" title="Semi Design" />
            <div className="caption">
                <h1>404 Not Found</h1>
                <div
                    style={{
                        textAlign: 'center',
                    }}
                >
                    <Button theme="solid" icon={<IconHome />} onClick={clickHome}>
                        Go Home
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ErrorPage;
