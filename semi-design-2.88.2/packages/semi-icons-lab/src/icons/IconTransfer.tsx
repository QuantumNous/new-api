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
            <path
                d="m7.07 20.35-5.48-4.38a.6.6 0 0 1 0-.94l5.48-4.38a.5.5 0 0 1 .81.39v2.26h5.67c.25 0 .45.2.45.45v3.5c0 .25-.2.45-.45.45H7.88v2.26a.5.5 0 0 1-.81.4Z"
                fill="#AAB2BF"
            />
            <path
                d="m13.8 5.63 7.6 5.9c.3.24.3.7 0 .94l-7.6 5.9a.5.5 0 0 1-.8-.4V14.8H7.5a.5.5 0 0 1-.5-.5V9.7c0-.28.22-.5.5-.5H13V6.02a.5.5 0 0 1 .8-.4Z"
                fill="white"
            />
            <path
                d="m14.8 4.63 7.6 5.9c.3.24.3.7 0 .94l-7.6 5.9a.5.5 0 0 1-.8-.4V13.8H8.5a.5.5 0 0 1-.5-.5V8.7c0-.28.22-.5.5-.5H14V5.02a.5.5 0 0 1 .8-.4Z"
                fill="#4CC3FA"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'transfer');
export default IconComponent;
