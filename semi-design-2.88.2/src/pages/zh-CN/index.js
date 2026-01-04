import React, { useEffect } from 'react';
import Home from 'src/sitePages/newHome';
import SEO from '../../components/seo';

const IndexPage = ({ location }) => {

    useEffect(() => {
        setTimeout(()=>{
            window?.__semi__?.Tea?.userVisited();
            window?.__semi__?.Tea?.eventHappened("refer", document?.referrer ?? 'empty');
        }, 3000);
    }, []);

    return (
        <div className="semi-site-page">
            <SEO lang="zh-CN" title="Semi Design" />
            <Home />
        </div>
    );
};

export default IndexPage;
