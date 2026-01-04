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
                d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 4c6.5 0 11 5.5 11 8s-4.5 8-11 8-11-5.5-11-8 4.5-8 11-8Zm0 2C9.33 6 7.03 7.13 5.38 8.57a9.39 9.39 0 0 0-1.86 2.16A3.1 3.1 0 0 0 3 12c0 .1.08.55.52 1.27.4.68 1.03 1.44 1.86 2.16A10.14 10.14 0 0 0 12 18c2.67 0 4.97-1.13 6.62-2.57a9.39 9.39 0 0 0 1.86-2.16A3.1 3.1 0 0 0 21 12c0-.1-.08-.55-.52-1.27a9.39 9.39 0 0 0-1.86-2.16A10.14 10.14 0 0 0 12 6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'eye_opened_stroked');
export default IconComponent;
