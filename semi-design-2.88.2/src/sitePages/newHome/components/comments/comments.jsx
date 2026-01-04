import { _t } from "src/utils/locale";
import React, { useEffect } from 'react';
import styles from "./comments.module.scss";
import classnames from 'classnames';

// 将 number 转换为千分位 string
function getNumString(number) {
    let str = number.toString();
    let len = str.length;
    if (len <= 3) {
        return str;
    } else {
        let n = len % 3;
        if (n === 0) {
            return str.match(/\d{3}/g).join(',');
        } else {
            return str.slice(0, n) + ',' + str.slice(n).match(/\d{3}/g).join(',');
        }
    }
}

// 出现在视口的回调函数，在 s 秒中完成数据从 0 递增到 number
function numberAnimation(number, s, dom) {
    var handle, 
        content = 0;
    // requestAnimationFrame 回调函数执行次数通常是每秒 60 次
    // time 为每次执行会调函数需要增加的大小
    var time = number / (s * 60); 
    var fn = () => {
        if (number - time <= content) {
            // 精度问题，最后一次结果不一定相等
            cancelAnimationFrame(handle);
            content = number;
        } else {
            content += time;
            handle = requestAnimationFrame(fn);
        }
        dom && (dom.innerHTML = `${getNumString(parseInt(content))}+`);
    };
    requestAnimationFrame(fn);
}

const realNumber = [7600, 560, 5000000, 100];

function Comments(props) {
    useEffect(()=> {
        const allElement = ["starNum", "forkNum", "downloadNum", "contributorNum"].map((item) => document.getElementById(item));
        const observer = new IntersectionObserver(entries => {
            entries.forEach((item, index) => {
                if (item.isIntersecting) {
                    numberAnimation(realNumber[index], 2, allElement[index]);
                    observer.unobserve(item.target);
                }
            });
        },
        {
            // root: document.body,
            // 距离视口上边距100px， 下边距500px时候触发回调
            rootMargin: "-100px 0px -500px 0px",  
        }
        );
        allElement.forEach(item => observer.observe(item));
    }, []);
    
    return (
        <div {...props} className={styles.frame}>
            <p className={styles.title} data-locale={"en-US"}>{_t("grow_with_users")}</p>
            <p className={styles.text_008e1ad6}>{_t("grow_with_users_description")}</p>
            <div className={styles.data}>
                <div className={styles.descriptionVerticalL}>
                    <p className={styles.key}>Stars</p>
                    <p id={"starNum"} className={styles.value}>0+</p>
                </div>
                <div className={styles.descriptionVerticalL}>
                    <p className={styles.key}>Fork</p>
                    <p id={"forkNum"} className={styles.value}>0+</p>
                </div>
                <div className={styles.descriptionVerticalL}>
                    <p className={styles.key}>{_t("download")}</p>
                    <p id={"downloadNum"} className={styles.value}>0+</p>
                </div>
                <div className={styles.descriptionVerticalL}>
                    <p className={styles.key}>{_t("contributor")}</p>
                    <p id={"contributorNum"} className={styles.value}>0+</p>
                </div>
            </div>
            <p className={styles.text_2}>{_t("thanks")}</p>
            <div style={{
                width: 389,
                height: 41,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '32px',
            }}>
                <span key='chromatic'>
                    <img
                        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/chromatic.png"
                        alt="chromatic logo"
                        className={styles.group3736} 
                    />
                    <img
                        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/chromatic-dark.png"
                        alt="chromatic logo"
                        className={`${styles.group3736dark}`} 
                    />
                </span>
                <span key='cypress'>
                    <img
                        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/cypress.png"
                        alt="cypress logo"
                        className={styles.group3736} 
                    />
                    <img
                        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/cypress-dark.png"
                        alt="cypress logo"
                        className={`${styles.group3736dark}`} 
                    />
                </span>
            </div>
            <div className={styles.comment}>
                <div className={styles.autoWrapper}>
                    <div className={styles.testimonial1}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1756c0-321a-11ec-adec-e911cea4cf98.png" className={styles.mColorCN} alt="user avatar" />
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e19c7c0-321a-11ec-b393-ab4adc2e449f.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback}><span className={styles.feedback_3a905c13}>{_t("access_is_simple_and_easy_to_use", { }, "接入简单易上手；")}</span></p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aMengzhou}>@Mengzhou</p>
                                    <p className={styles.text_18f690df}>{_t("front_end__bytedance", { }, "前端, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.testimonial1}>
                        <div className={styles.mColorCN_beba3295}>
                            <div className={styles.autoWrapper_4fa00029}>
                                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e17a4e1-321a-11ec-9c23-a9f1bde3758e.svg" className={styles.autoWrapper_4fa00029} alt="user avatar" />
                                <p className={styles.text_b1d6cd66}>C</p>
                            </div>
                        </div>
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e190470-321a-11ec-b008-15e09471f238.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback}>{_t("the_components_are_quite_complete__covering_a_wide_range_and_the_overall_style_i_e10d9214b403886d249f00b8c4dbb975", { }, "组件挺全的，覆盖的比较广泛，整体风格也不错。")}</p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aChangyi}>@Changyi</p>
                                    <p className={styles.text_18f690df}>{_t("front_end__bytedance", { }, "前端, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.testimonial7}>
                        <div className={styles.mColorCN_beba3295}>
                            <div className={styles.autoWrapper_4fa00029}>
                                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1ab220-321a-11ec-ab65-77a60c02a0b5.svg" className={styles.autoWrapper_4fa00029} alt="user avatar" />
                                <p className={styles.text_11043f46}>M</p>
                            </div>
                        </div>
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1ad930-321a-11ec-ab65-77a60c02a0b5.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback_daa8760d}>{_t("design_resources_are_obviously_helpful_to_improve_efficiency_", { }, "设计资源对提效有明显帮助。")}</p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aMiaomiao}>@Miaomiao</p>
                                    <p className={styles.text_18f690df}>{_t("design__bytedance", { }, "设计, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.autoWrapper}>
                    <div className={styles.testimonial1}>
                        <div className={styles.mColorCN_beba3295}>
                            <div className={styles.autoWrapper_4fa00029}>
                                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e190470-321a-11ec-8b14-8fb159794ae4.svg" className={styles.autoWrapper_4fa00029} alt="user avatar" />
                                <p className={styles.text_f8842908}>Y</p>
                            </div>
                        </div>
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1b0040-321a-11ec-ab65-77a60c02a0b5.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback}>{_t("there_are_many_other_business_uses_within_the_company__there_are_more_sample_ref_c5fe7051d5fbf1a547084c91f7c4fd8e", { }, "有很多公司内的其他业务使用，有比较多的样例参考，我们依托")}</p>
                                <div className={styles.personDetails_53392045}>
                                    <p className={styles.aYinfeng}>@Yinfeng</p>
                                    <p className={styles.text_05913fb1}>{_t("product_manager__bytedance", { }, "产品经理, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.testimonial1}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e190471-321a-11ec-b008-15e09471f238.png" className={styles.mColorCN} alt="user avatar" />
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1a15e0-321a-11ec-b393-ab4adc2e449f.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback}>{_t("super_good!_strong_push_", { }, "超级好用！强推。")}</p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aMengzhou}>@Dingwei</p>
                                    <p className={styles.text_18f690df}>{_t("front_end__bytedance", { }, "前端, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.testimonial7}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e192b80-321a-11ec-8b14-8fb159794ae4.png" className={styles.mColorCN} alt="user avatar" />
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1979a0-321a-11ec-adec-e911cea4cf98.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback}>{_t("as_an_excellent_benchmarking_industry", { }, "作为对标业界优秀的")}</p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aJingyu}>@Jingyu</p>
                                    <p className={styles.text_18f690df}>{_t("front_end__bytedance", { }, "前端, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.frame4571}>
                    <div className={styles.testimonial3}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1b2750-321a-11ec-ab65-77a60c02a0b5.png" className={styles.mColorCN} alt="user avatar" />
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1a3cf0-321a-11ec-b393-ab4adc2e449f.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback}>{_t("easy_to_use__beautiful_style_", { }, "使用方便，样式美观。")}</p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aYucang}>@Yucang</p>
                                    <p className={styles.text_18f690df}>{_t("front_end__bytedance", { }, "前端, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.testimonial1}>
                        <div className={styles.mColorCN_beba3295}>
                            <div className={styles.autoWrapper_4fa00029}>
                                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1b9c80-321a-11ec-ab65-77a60c02a0b5.svg" className={styles.autoWrapper_4fa00029} alt="user avatar" />
                                <p className={styles.text_b1d6cd66}>G</p>
                            </div>
                        </div>
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e19a0b0-321a-11ec-9c23-a9f1bde3758e.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback}>{_t("uniform_style_and_high_fidelity_prototype_facilitate_communication_with_front_en_95d0c0ccece05c104b98ac0dae9fb53b", { }, "统一的样式，高保真的原型便于与前端同学进行沟通。")}</p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aGuangye}>@Guangye</p>
                                    <p className={styles.text_05913fb1}>{_t("product_manager__bytedance", { }, "产品经理, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.testimonial7}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e1979a1-321a-11ec-adec-e911cea4cf98.png" className={styles.mColorCN} alt="user avatar" />
                        <div className={styles.frame4569}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img src="https://lf9-static.semi.design/obj/semi-tos/images/7e19c7c0-321a-11ec-9c23-a9f1bde3758e.svg" className={styles.quoteMark} alt="quote icon" />
                            <div className={styles.feedbackPersonDetail}>
                                <p className={styles.feedback_daa8760d}>{_t("the_documentation_is_very_detailed_and_the_details_of_the_components_are_well_th_aadc51a1122c41cf69ebd4b15e83e864", { }, "文档非常详细，对组件的细节思考非常充足。")}</p>
                                <div className={styles.personDetails}>
                                    <p className={styles.aBaifu}>@Baifu</p>
                                    <p className={styles.text_18f690df}>{_t("front_end__bytedance", { }, "前端, 字节跳动")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Comments;
