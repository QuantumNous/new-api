import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path d="M2 5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Z" fill="#DDE3E8" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12.16 4.98a.87.87 0 1 0-1.74-.21L9.26 14.1a.88.88 0 0 0 1.73.22l1.17-9.34Zm.85 1.03a.87.87 0 0 1 1.23 0l2.92 2.91c.34.34.34.9 0 1.24l-2.92 2.92a.87.87 0 1 1-1.23-1.24l2.3-2.3-2.3-2.3a.88.88 0 0 1 0-1.23Z"
                fill="#AAB2BF"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M13 6a.87.87 0 0 1 1.24 0l2.92 2.92c.34.34.34.9 0 1.24l-2.92 2.92a.87.87 0 1 1-1.23-1.24l2.3-2.3-2.3-2.3a.88.88 0 0 1 0-1.23Z"
                fill="#4CC3FA"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.41 6a.88.88 0 0 0-1.24 0L4.26 8.93a.88.88 0 0 0 0 1.24l2.91 2.92a.88.88 0 1 0 1.24-1.24l-2.3-2.3 2.3-2.3a.88.88 0 0 0 0-1.23Z"
                fill="#FBCD2C"
            />
            <path
                d="m18.46 11.62 2.91 2.92 1.22-1.22c.46-.45.46-1.19 0-1.65l-1.27-1.26a1.17 1.17 0 0 0-1.64 0l-1.22 1.21Z"
                fill="#6A6F7F"
            />
            <path
                d="m11.31 21.33.98-3.43c.03-.1.08-.19.15-.26l5.14-5.14 2.92 2.92-5.14 5.14a.58.58 0 0 1-.26.15l-3.43.98a.3.3 0 0 1-.36-.36Z"
                fill="#6A6F7F"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'json-viewer');
export default IconComponent;
