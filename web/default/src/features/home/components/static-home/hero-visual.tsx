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
import { Cpu, Hexagon, RadioTower } from 'lucide-react'
import { heroOrbitItems } from './content'

type HeroVisualProps = {
  label: string
}

export function HeroVisual({ label }: HeroVisualProps) {
  return (
    <section className='home-hero-visual' aria-label={label}>
      <div className='home-hero-visual__aura' aria-hidden='true' />
      <div className='home-hero-visual__token' aria-hidden='true'>
        <Hexagon className='size-16' />
        <strong>AiApi114</strong>
      </div>
      <div className='home-hero-visual__platform' aria-hidden='true'>
        <div className='home-hero-visual__chip'>
          <Cpu className='size-8' />
        </div>
        <span className='home-hero-visual__pulse' />
        <span className='home-hero-visual__ring home-hero-visual__ring--one' />
        <span className='home-hero-visual__ring home-hero-visual__ring--two' />
      </div>
      <RadioTower className='home-hero-visual__beam' aria-hidden='true' />
      {heroOrbitItems.map((item) => {
        const Icon = item.icon
        return (
          <span
            className={`home-hero-orbit-item ${item.className}`}
            key={item.className}
            aria-hidden='true'
          >
            <Icon className='size-5' />
          </span>
        )
      })}
    </section>
  )
}
