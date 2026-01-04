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
                d="M2.85 19.13c.77 0 1.2-.4 1.5-1.4l.82-2.5h5.14l.83 2.5c.3 1 .74 1.4 1.53 1.4.82 0 1.37-.5 1.37-1.27 0-.3-.07-.65-.22-1.12l-3.7-10.59c-.46-1.37-1.1-1.93-2.32-1.93-1.22 0-1.88.57-2.34 1.93l-3.7 10.6a3.8 3.8 0 0 0-.26 1.16c0 .74.55 1.22 1.35 1.22Zm2.96-6.06 1.87-5.93h.14l1.86 5.93H5.81Z"
                fill="#6A6F7F"
            />
            <path
                d="M16.93 15.98c0-.8.6-1.28 1.6-1.28h1.89v1.02c0 .92-.83 1.65-1.88 1.65-.96 0-1.6-.57-1.6-1.39Zm3.6 2.05v-.28.34c.07.64.5 1 1.14 1 .76 0 1.19-.47 1.19-1.3V12.4c0-2.18-1.45-3.4-4.03-3.4-1.07 0-1.9.18-2.52.5-.86.45-1.26 1.03-1.26 1.6 0 .5.33.87.87.87.4 0 .66-.1.94-.33.54-.49 1.07-.77 1.81-.77 1.13 0 1.75.52 1.75 1.52v.8h-2.34c-2.23 0-3.58 1.12-3.58 2.94 0 1.8 1.3 3 3.22 3 1.2 0 2.3-.22 2.8-1.1Z"
                fill="#AAB2BF"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'typography');
export default IconComponent;
