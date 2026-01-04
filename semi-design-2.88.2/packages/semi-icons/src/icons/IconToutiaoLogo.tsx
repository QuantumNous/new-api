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
                fillRule="evenodd"
                clipRule="evenodd"
                d="M24 4 0 5.25v14.21l24-1.25V4Zm-3.05 2.59h.12v1.5c-.42.4-1.06.99-2.16 1.62.76.15 1.65.3 2.68.42v1.38c-1.99-.22-3.5-.52-4.67-.86-1.18.47-2.69.94-4.6 1.35V10.6c1-.22 1.88-.45 2.63-.68a10.77 10.77 0 0 1-2.37-1.47l1.4-2.16 1.4.58 5.57-.29Zm-9.28 7.17-3.67.2c-.58.93-1.5 1.82-2.92 3.08l-2.32.12.25-.22.04-.03.04-.04c1.41-1.22 2.38-2.07 3.05-2.82l-3.74.2v-1.3l4.63-.25c.52-1.18.56-2.83.6-5.74l1.47-.08c-.03 2.78-.09 4.44-.49 5.74l3.06-.16v1.3ZM3.26 7.5v1.46l3.28.3V7.8l-3.28-.3Zm3.28 4.2v-1.44l-3.29-.3v1.45l3.29.3Zm11.16 1.73 3.89-.2v-1.3l-3.9.2v-.74l-1.5.08v.74l-3.87.2v1.3l3.87-.2v2.94l1.5-.08v-2.94ZM9.88 16.8l1.79-.1-1.44-2.2-1.78.09 1.43 2.2Zm11.72-.61-1.78.09-1.43-2.21 1.78-.1 1.43 2.22Zm-9.27.48 1.78-.1 1.43-2.35-1.78.09-1.43 2.36Zm6.86-8.68-4.48.24c.5.3 1.21.65 2.25.99 1.05-.45 1.74-.87 2.23-1.23Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'toutiao_logo');
export default IconComponent;
