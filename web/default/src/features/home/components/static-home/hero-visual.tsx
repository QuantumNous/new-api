/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { CSSProperties } from 'react'
type HeroVisualProps = {
  label: string
}

export function HeroVisual({ label }: HeroVisualProps) {
  const maskAssets = {
    '--aiapi-hero-badge-mask': 'url("/assets/hero/hero-badge-custom.png")',
    '--aiapi-hero-base-mask': 'url("/assets/hero/hero-base-custom.png")',
  } as CSSProperties

  return (
    <section
      className='aiapi-hero-visual static-home__hero-motion'
      style={maskAssets}
      aria-label={label}
    >
      <picture>
        <img
          className='aiapi-hero-visual__base'
          src='/assets/hero/hero-base-custom.png'
          alt='AiApi114 platform base'
          decoding='async'
        />
      </picture>
      <div className='aiapi-hero-ripples' aria-hidden='true'>
        <span className='aiapi-hero-ripple' />
        <span className='aiapi-hero-ripple' />
        <span className='aiapi-hero-ripple' />
        <span className='aiapi-hero-ripple' />
      </div>
      <div className='aiapi-hero-beam' aria-hidden='true' />
      <div className='aiapi-hero-beam-softcap' aria-hidden='true' />
      <div className='aiapi-hero-badge' aria-hidden='true'>
        <div className='aiapi-hero-badge__halo' />
        <div className='aiapi-hero-badge__orbit'>
          <div className='aiapi-hero-badge__face'>
            <img src='/assets/hero/hero-badge-custom.png' alt='' decoding='async' />
            <span className='aiapi-hero-badge__shine' />
          </div>
        </div>
      </div>
      <div
        className='aiapi-hero-icon aiapi-hero-icon--circle aiapi-hero-icon--lt'
        aria-hidden='true'
      >
        <img src='/assets/hero/icon-gear.svg' alt='' />
      </div>
      <div
        className='aiapi-hero-icon aiapi-hero-icon--tile aiapi-hero-icon--lb'
        aria-hidden='true'
      >
        <img src='/assets/hero/icon-cloud-gear.svg' alt='' />
      </div>
      <div
        className='aiapi-hero-icon aiapi-hero-icon--circle aiapi-hero-icon--rt'
        aria-hidden='true'
      >
        <img src='/assets/hero/icon-chart.svg' alt='' />
      </div>
      <div
        className='aiapi-hero-icon aiapi-hero-icon--tile aiapi-hero-icon--rb'
        aria-hidden='true'
      >
        <img src='/assets/hero/icon-code.svg' alt='' />
      </div>
      <div className='aiapi-hero-particles' aria-hidden='true'>
        <span className='aiapi-hero-particle' />
        <span className='aiapi-hero-particle' />
        <span className='aiapi-hero-particle' />
        <span className='aiapi-hero-particle' />
        <span className='aiapi-hero-particle' />
      </div>
    </section>
  )
}
