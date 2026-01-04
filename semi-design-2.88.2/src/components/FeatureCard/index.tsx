import React from 'react';
import './index.scss';

interface FeatureCardProps {
    style?: React.CSSProperties;
    title?: React.ReactNode;
    children?: React.ReactNode
}

export default function FeatureCard({ title, style, children }: FeatureCardProps) {
    return (
        <div className='feature-card' style={style}>
            <div className='feature-card-title'>{title}</div>
            <div className='feature-card-content'>{children}</div>
        </div>
    );
}