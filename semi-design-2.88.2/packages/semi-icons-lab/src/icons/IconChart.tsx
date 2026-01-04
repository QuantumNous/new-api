import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path
                d="M21.9 11.25c.58 0 1.05-.5.95-1.06a11 11 0 0 0-9.04-9.04c-.57-.1-1.06.37-1.06.94v4.1c0 .5.37.91.84 1.07a5.01 5.01 0 0 1 3.15 3.15c.16.47.57.84 1.07.84h4.1Z"
                fill="#4CC3FA"
                style={{
                    fill: 'color(display-p3 0.2980 0.7647 0.9804)',
                    fillOpacity: 1,
                }}
            />
            <path
                d="M17.8 12.75c-.49 0-.9.37-1.06.84a5 5 0 0 1-6.97 2.89c-.45-.23-1-.2-1.34.15l-2.19 2.19c-.41.41-.39 1.09.1 1.42a10 10 0 0 0 15.5-6.42c.1-.57-.36-1.07-.94-1.07h-3.1Z"
                fill="#6A6F7F"
                style={{
                    fill: 'color(display-p3 0.4157 0.4353 0.4980)',
                    fillOpacity: 1,
                }}
            />
            <path
                d="M8.43 7.37c.35.35.9.38 1.34.15.2-.1.42-.19.64-.26.47-.16.84-.57.84-1.06V3.1c0-.58-.5-1.04-1.07-.94-1.4.26-2.71.82-3.85 1.6-.48.33-.5 1-.09 1.42l2.19 2.19Z"
                fill="#DDE3E8"
                style={{
                    fill: 'color(display-p3 0.8667 0.8902 0.9098)',
                    fillOpacity: 1,
                }}
            />
            <path
                d="M7.37 15.57c.35-.35.38-.9.15-1.34a4.98 4.98 0 0 1 0-4.46c.23-.45.2-1-.15-1.34L5.18 6.24c-.41-.41-1.09-.39-1.42.1a9.95 9.95 0 0 0 0 11.33c.33.48 1 .5 1.42.09l2.19-2.19Z"
                fill="#AAB2BF"
                style={{
                    fill: 'color(display-p3 0.6667 0.6980 0.7490)',
                    fillOpacity: 1,
                }}
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'chart');
export default IconComponent;
