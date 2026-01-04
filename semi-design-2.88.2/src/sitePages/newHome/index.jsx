import React, { useEffect, useState } from 'react';
import Banner from './components/banner/banner.jsx';
import Products from './components/products/products.jsx';
import Feature from './components/feature/feature.jsx';
import Comments from './components/comments/comments.jsx';
import DeepContent from './components/deepContent/deepContent.jsx';
import Resource from './components/resource/resource.jsx';
import Dsm from './components/dsm/dsm.jsx';
import Pro from './components/pro/pro.jsx';
import Application from './components/application/application.jsx';
import Theme from './components/theme/theme.jsx';
import styles from './index.module.scss';
import { getLocale } from '../../utils/locale.js';
import classnames from 'classnames';
import AOS from 'aos';
import 'aos/dist/aos.css';

function NewHome() {
    const [locale, setLocale] = useState('');

    useEffect(() => {
        AOS.init();
    }, []);

    useEffect(() => {
        setLocale(getLocale());
    }, []);

    return (
        <div className={classnames(styles.homePage, { [styles.homeEnglish]: locale === 'en-US' })}>
            <Banner></Banner>
            <Products data-aos="fade-in"></Products>
            <Feature data-aos="fade-in"></Feature>
            <Theme data-aos="fade-in"></Theme>
            <Dsm data-aos="fade-in"></Dsm>
            <Pro data-aos="fade-in"></Pro>
            <Application data-aos="fade-in"></Application>
            <DeepContent data-aos="fade-in"></DeepContent>
            <Comments data-aos="fade-in"></Comments>
            <Resource data-aos="fade-in"></Resource>
        </div>
    );
}

export default NewHome;
