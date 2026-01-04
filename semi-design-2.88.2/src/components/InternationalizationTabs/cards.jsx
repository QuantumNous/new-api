import React from 'react';
import './index.scss';

function ImageCard({ icon, title, image, description }) {
    return (
        <div className="internationalization-image-card">
            <div className="internationalization-image-card-title">
                {icon}  
                {title}
            </div>
            <div className="internationalization-image-card-image">
                <img src={image} alt={title} style={{ width: '100%', height: '100%' }} />
            </div>
            <div className="internationalization-image-card-description">
                {description}
            </div>
        </div>
    );
}

const ColorImageCard = ({ color, icon, title, image, description }) => {
    return (
        <div className={`internationalization-color-image-card internationalization-color-image-card-${color}`}>
            <div className={`internationalization-color-image-card-${color}-title`}>
                {icon}
                {title}
            </div>
            <div className="internationalization-color-image-card-image">
                <img src={image} alt={title} style={{ width: '100%' }} />
            </div>
            <div className="internationalization-color-image-card-description">
                <div className="md markdown gatsby-p">{description}</div>
            </div>
        </div>
    );
};

const ImageList = ({ title, image, description }) => {
    return (
        <div className="internationalization-image-list">
            <div className="internationalization-image-list-image">
                <img src={image} alt={title} style={{ height: '100%', width: '240px' }} />
            </div>
            <div>
                <div className="internationalization-image-list-title">{title}</div>
                <div className="internationalization-image-list-description">
                    <div className="md markdown gatsby-p">{description}</div>
                </div>
            </div>
        </div>
    );
};

const TextCard = ({ color, title, description }) => {
    return (
        <div className={`internationalization-text-card internationalization-text-card-${color}`} >
            <div className="internationalization-text-card-title">{title}</div>
            {
                description.map((item, index) => (
                    <div className="internationalization-text-card-description" key={index}>{item}</div>
                ))
            }
        </div>
    );
};

const ColorCard = ({ color, icon, title, description }) => {
    return (
        <div className={`internationalization-color-card internationalization-color-card-${color}`}>
            <div className={`internationalization-color-card-${color}-title`}>
                {icon}
                {title}
            </div>
            <div className="internationalization-color-card-description md markdown gatsby-p">{description}</div> 
        </div>
    );
};

const ColorList = ({ color, title, description }) => {
    return (
        <div className={`internationalization-color-list internationalization-color-list-${color}`}>
            <div className={`internationalization-color-list-${color}-title`}>{title}</div>
            <div className="md markdown gatsby-p internationalization-color-list-description">{description}</div>
        </div>
    );
};

export {
    ImageCard,
    ImageList,
    TextCard,
    ColorCard,
    ColorList,
    ColorImageCard
};