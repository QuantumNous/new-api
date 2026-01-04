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
                d="M10.3 1a1 1 0 0 0-.98.78l-.67 2.95a8 8 0 0 0-1.27.74l-2.9-.9a1 1 0 0 0-1.16.46l-1.7 2.94a1 1 0 0 0 .19 1.24l2.22 2.06a8.1 8.1 0 0 0 0 1.46L1.81 14.8a1 1 0 0 0-.19 1.24l1.7 2.94a1 1 0 0 0 1.17.46l2.9-.9a8 8 0 0 0 1.26.74l.67 2.95c.1.46.51.78.98.78h3.4a1 1 0 0 0 .98-.78l.67-2.95c.45-.2.87-.46 1.27-.74l2.9.9a1 1 0 0 0 1.16-.46l1.7-2.94a1 1 0 0 0-.19-1.24l-2.22-2.06a8.1 8.1 0 0 0 0-1.46l2.22-2.06a1 1 0 0 0 .19-1.24l-1.7-2.94a1 1 0 0 0-1.17-.46l-2.9.9a8 8 0 0 0-1.26-.74l-.67-2.95A1 1 0 0 0 13.7 1h-3.4Z"
                fill="#DDE3E8"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
                fill="#AAB2BF"
            />
            <circle cx={12} cy={12} r={3} fill="#324350" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'config');
export default IconComponent;
