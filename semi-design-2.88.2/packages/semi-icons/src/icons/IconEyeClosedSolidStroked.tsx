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
                d="M20.1 2.3a1 1 0 0 1 1.4 1.4L3.13 22.1a1 1 0 1 1-1.41-1.42l3.36-3.37C2.52 15.51 1 13.04 1 11.6c0-2.5 4.5-8 11-8 2.03 0 3.87.54 5.44 1.35l2.65-2.65ZM12 5.58c-2.67 0-4.97 1.13-6.62 2.57a9.39 9.39 0 0 0-1.86 2.15A3.1 3.1 0 0 0 3 11.6c0 .1.08.54.52 1.27.4.67 1.03 1.44 1.86 2.16.34.3.72.59 1.13.86l2.13-2.13a4 4 0 0 1 5.53-5.53l1.77-1.78A9.64 9.64 0 0 0 12 5.59Zm0 4a2 2 0 0 0-1.88 2.68l2.56-2.57A2 2 0 0 0 12 9.6Z"
                fill="currentColor"
            />
            <path
                d="M20.27 6.95C22 8.57 23 10.4 23 11.59c0 2.5-4.5 8-11 8-1.34 0-2.6-.24-3.74-.63l1.61-1.62c.68.16 1.39.25 2.13.25 2.67 0 4.97-1.14 6.62-2.57a9.39 9.39 0 0 0 1.86-2.16c.44-.73.52-1.17.52-1.27 0-.1-.08-.55-.52-1.28a9.2 9.2 0 0 0-1.63-1.95l1.42-1.41Z"
                fill="currentColor"
            />
            <path d="m15.98 11.23.02.36a4 4 0 0 1-4.36 3.98l4.34-4.34Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'eye_closed_solid_stroked');
export default IconComponent;
