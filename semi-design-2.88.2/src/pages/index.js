import React, { useEffect } from 'react';
import { navigate } from 'gatsby';
import Home from 'src/sitePages/newHome';
import SEO from '../components/seo';

const IndexPage = ({ location }) => {
    useEffect(() => {
        let locale = localStorage.getItem('locale');
        console.log('redirect', locale);
        if (locale) {
            navigate(`/${ locale}`);
        } else {
            navigate('/' + 'zh-CN');
        }
    });


    return (
        <div className="semi-site-page">
            <SEO lang="zh-CN" title="Semi Design" />
            <Home />
        </div>
    );
};

export default IndexPage;
