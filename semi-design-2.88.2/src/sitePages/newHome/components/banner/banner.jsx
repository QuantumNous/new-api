/* eslint-disable jsx-a11y/click-events-have-key-events */
import { _t, getLocale } from "src/utils/locale";
import React from 'react';
import styles from "./banner.module.scss";
import OperateButton from "../operateButton/operateButton.jsx";
import classnames from 'classnames';
import { Typography } from "../../../../../packages/semi-ui";

function Banner() {

    return (
        <div className={classnames(styles.frame4565, styles.frame4565_pos)}>
            <div className={classnames(styles.content, styles.content_pos)}>
                <p className={styles.title} data-locale={"en-US"}>{_t("enterprise_product_design_system")}</p>
                <p className={styles.subtitle}>{_t("home_banner_description")}</p>
                <OperateButton />
                <div className={styles.frameworksWrapper}>
                    <div style={{ display: "flex", alignItems: 'center', marginBottom: "12px", position: 'relative', top: 0 }}>
                        {getLocale()!=="zh-CN" && <Typography.Text type={"tertiary"} style={{ fontSize: '20px', fontWeight: '300' }}>Compatible
                            with</Typography.Text>}
                    </div>
                    <div style={{ display: 'flex', position: 'relative', top: 30 }}>
                        <svg style={{ transform: 'scale(0.8)', color: "var(--react-logo-color)", position: 'absolute', left: -220, top: -22 }} width="100%" height="100%" viewBox="-10.5 -9.45 21 18.9" fill="none" xmlns="http://www.w3.org/2000/svg" className="mt-4 mb-3 text-link dark:text-link-dark w-24 lg:w-28 self-center text-sm me-0 flex origin-center transition-all ease-in-out"><circle cx="0" cy="0" r="2" fill="currentColor"></circle><g stroke="currentColor" strokeWidth="1" fill="none"><ellipse rx="10" ry="4.5"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(60)"></ellipse><ellipse rx="10" ry="4.5" transform="rotate(120)"></ellipse></g></svg>
                        <svg style={{ transform: "scale(0.1) translate(-1470px, -2640px)", position: 'absolute' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 790 876"><path d="m704.9 641.7-305.1 172.6v-134.4l190.1-104.6zm20.9-18.9v-360.9l-111.6 64.5v232zm-657.9 18.9 305.1 172.6v-134.4l-190.2-104.6zm-20.9-18.9v-360.9l111.6 64.5v232zm13.1-384.3 312.9-177v129.9l-200.5 110.3-1.6.9zm652.6 0-312.9-177v129.9l200.5 110.2 1.6.9z" fill="#8ed6fb"/><path d="m373 649.3-187.6-103.2v-204.3l187.6 108.3zm26.8 0 187.6-103.1v-204.4l-187.6 108.3zm-201.7-331.1 188.3-103.5 188.3 103.5-188.3 108.7z" fill="#1c78c0"/></svg>
                        <svg style={{ transform: "scale(0.1)", position: 'absolute', left: -40, top: -202 }} xmlns="http://www.w3.org/2000/svg" width="410" height="404" viewBox="0 0 410 404" fill="none">
                            <path d="M399.641 59.5246L215.643 388.545C211.844 395.338 202.084 395.378 198.228 388.618L10.5817 59.5563C6.38087 52.1896 12.6802 43.2665 21.0281 44.7586L205.223 77.6824C206.398 77.8924 207.601 77.8904 208.776 77.6763L389.119 44.8058C397.439 43.2894 403.768 52.1434 399.641 59.5246Z" fill="url(#paint0_linear)"/>
                            <path d="M292.965 1.5744L156.801 28.2552C154.563 28.6937 152.906 30.5903 152.771 32.8664L144.395 174.33C144.198 177.662 147.258 180.248 150.51 179.498L188.42 170.749C191.967 169.931 195.172 173.055 194.443 176.622L183.18 231.775C182.422 235.487 185.907 238.661 189.532 237.56L212.947 230.446C216.577 229.344 220.065 232.527 219.297 236.242L201.398 322.875C200.278 328.294 207.486 331.249 210.492 326.603L212.5 323.5L323.454 102.072C325.312 98.3645 322.108 94.137 318.036 94.9228L279.014 102.454C275.347 103.161 272.227 99.746 273.262 96.1583L298.731 7.86689C299.767 4.27314 296.636 0.855181 292.965 1.5744Z" fill="url(#paint1_linear)"/>
                            <defs>
                                <linearGradient id="paint0_linear" x1="6.00017" y1="32.9999" x2="235" y2="344" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#41D1FF"/>
                                    <stop offset="1" stopColor="#BD34FE"/>
                                </linearGradient>
                                <linearGradient id="paint1_linear" x1="194.651" y1="8.81818" x2="236.076" y2="292.989" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#FFEA83"/>
                                    <stop offset="0.0833333" stopColor="#FFDD35"/>
                                    <stop offset="1" stopColor="#FFA800"/>
                                </linearGradient>
                            </defs>
                        </svg>
                        <a style={{ position: 'absolute', height: 'fit-content', left: 224, top: -26 }} href={"https://www.rspack.dev"} aria-label={"rspack"} target={"_blank"} rel="noreferrer">
                            <img style={{ width: "60px", position: "relative", left: "-18px" }} alt='rspack logo' src={"https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/rspack.png"}/>
                        </a>
                        <svg aria-label={"remix"} style={{ position: 'relative', top: "-16px", left: "304px", transform: 'scale(1.3)' }} height="24" viewBox="0 0 350 165" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><title>Remix Logo</title>
                            <path fillRule="evenodd" clipRule="evenodd" d="M133.85 124.16C135.3 142.762 135.3 151.482 135.3 161H92.2283C92.2283 158.927 92.2653 157.03 92.3028 155.107C92.4195 149.128 92.5411 142.894 91.5717 130.304C90.2905 111.872 82.3473 107.776 67.7419 107.776H54.8021H0V74.24H69.7918C88.2407 74.24 97.4651 68.632 97.4651 53.784C97.4651 40.728 88.2407 32.816 69.7918 32.816H0V0H77.4788C119.245 0 140 19.712 140 51.2C140 74.752 125.395 90.112 105.665 92.672C122.32 96 132.057 105.472 133.85 124.16Z" fill="currentColor"></path>
                            <path d="M0 161V136H45.5416C53.1486 136 54.8003 141.638 54.8003 145V161H0Z" fill="currentColor"></path>
                        </svg>
                        <svg width="82" height="48" viewBox="0 0 82 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'relative', left: '310px', top: '-26px' }}>
                            <title>Nextjs</title>
                            <path d="M15.4876 14.442H27.8676V15.4282H16.6227V22.85H27.1969V23.8362H16.6227V31.9847H27.9964V32.9709H15.4876V14.442V14.442ZM28.9764 14.442H30.292L36.1209 22.5905L42.0787 14.442L50.1822 4.0918L36.8689 23.4469L43.7293 32.9709H42.3622L36.1209 24.3034L29.8538 32.9709H28.5124L35.4244 23.4469L28.9769 14.442H28.9764ZM44.2196 15.4282V14.442H58.3271V15.4282H51.828V32.9705H50.6929V15.4282H44.22H44.2196ZM0 14.442H1.41867L20.9791 43.7767L12.8956 32.9709L1.18622 15.8434L1.13467 32.9709H0V14.442V14.442ZM58.2133 31.6869C57.9809 31.6869 57.8071 31.5069 57.8071 31.2745C57.8071 31.0416 57.9809 30.8616 58.2129 30.8616C58.4476 30.8616 58.6187 31.0416 58.6187 31.2745C58.6187 31.5069 58.4476 31.6869 58.2129 31.6869H58.2133ZM59.328 30.6011H59.9356C59.944 30.9309 60.1844 31.1522 60.5373 31.1522C60.932 31.1522 61.1556 30.9145 61.1556 30.4682V27.6434H61.7738V30.4709C61.7738 31.2745 61.3102 31.7371 60.5427 31.7371C59.8227 31.7371 59.3284 31.2882 59.3284 30.6011H59.328ZM62.5822 30.5656H63.1951C63.2476 30.9447 63.6173 31.1856 64.1502 31.1856C64.6467 31.1856 65.0111 30.9278 65.0111 30.5736C65.0111 30.2691 64.7796 30.086 64.252 29.9616L63.7387 29.8371C63.0187 29.6682 62.6898 29.3189 62.6898 28.7318C62.6898 28.0198 63.2693 27.546 64.1387 27.546C64.9476 27.546 65.5387 28.0198 65.5742 28.6927H64.9724C64.9147 28.3247 64.5947 28.0945 64.1307 28.0945C63.6418 28.0945 63.3164 28.33 63.3164 28.69C63.3164 28.9754 63.5262 29.1389 64.0453 29.2607L64.484 29.3687C65.3009 29.5598 65.6378 29.8922 65.6378 30.4931C65.6378 31.2576 65.0467 31.7371 64.1031 31.7371C63.22 31.7371 62.6262 31.2798 62.5822 30.5651V30.5656Z" fill="currentColor"/>
                        </svg>
                    </div>

                </div>
            </div>
            <div className={classnames(styles.autoWrapper_4fa00029, styles.autoWrapper_4fa00029_pos)}>
                <div className={styles.background}></div>
                <img
                    src="https://lf9-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/37361.png"
                    alt="semi application demo"
                    className={styles.group3736} />
                <img
                    src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/desk-dark.png"
                    alt="semi application demo"
                    className={`${styles.group3736dark}`} />
            </div>
        </div>
    );
}

export default Banner;
