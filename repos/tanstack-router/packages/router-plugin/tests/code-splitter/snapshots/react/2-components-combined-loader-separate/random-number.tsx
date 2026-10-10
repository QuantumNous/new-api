const $$splitComponentImporter = () => import('random-number.tsx?tsr-split=component---errorComponent---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
const $$splitLoaderImporter = () => import('random-number.tsx?tsr-split=loader');
import { lazyFn } from '@tanstack/react-router';
import { Await, Link, createFileRoute } from '@tanstack/react-router';
import { Carbon } from '~/components/Carbon';
import { twMerge } from 'tailwind-merge';
import { FaDiscord, FaGithub, FaTshirt } from 'react-icons/fa';
import { CgMusicSpeaker, CgSpinner } from 'react-icons/cg';
import { Footer } from '~/components/Footer';
import SponsorPack from '~/components/SponsorPack';
import { LogoColor } from '~/components/LogoColor';
import agGridImage from '~/images/ag-grid.png';
import nozzleImage from '~/images/nozzle.png';
import bytesImage from '~/images/bytes.svg';
import bytesUidotdevImage from '~/images/bytes-uidotdev.png';
export const textColors = [`text-rose-500`, `text-yellow-500`, `text-teal-500`, `text-blue-500`];
export const gradients = [`from-rose-500 to-yellow-500`, `from-yellow-500 to-teal-500`, `from-teal-500 to-violet-500`, `from-blue-500 to-pink-500`];
const courses = [{
  name: 'The Official TanStack React Query Course',
  cardStyles: `border-t-4 border-red-500 hover:(border-green-500)`,
  href: 'https://query.gg/?s=tanstack',
  description: `Learn how to build enterprise quality apps with TanStack's React Query the easy way with our brand new course.`
}];
export const Route = createFileRoute('/')({
  loader: lazyFn($$splitLoaderImporter, 'loader'),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});