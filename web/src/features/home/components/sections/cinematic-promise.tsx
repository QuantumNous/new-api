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
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

export function CinematicPromise() {
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 18,
    damping: 34,
    mass: 1.7,
  })
  const y = useTransform(smoothProgress, [0, 1], [90, -130])
  const rotateX = useTransform(smoothProgress, [0, 0.5, 1], [23, 8, -5])
  const opacity = useTransform(
    smoothProgress,
    [0.08, 0.3, 0.78, 0.96],
    [0, 1, 1, 0.25]
  )

  return (
    <section
      ref={sectionRef}
      className='dopa-cinematic-promise'
      data-section='PROMISE'
    >
      <div className='dopa-cinematic-promise__veil' aria-hidden='true' />
      <div className='dopa-cinematic-promise__orbit' aria-hidden='true'>
        <i />
        <i />
        <i />
      </div>

      <motion.div
        className='dopa-cinematic-promise__copy'
        style={
          reduceMotion
            ? undefined
            : {
                opacity,
                rotateX,
                y,
              }
        }
      >
        <span>
          {t('The same powerful experience, without the high monthly cost')}
        </span>
        <p>
          {t(
            "No complicated setup and no expensive subscription barrier. Configure once, pay only as you go, and put the latest productivity within everyone's reach."
          )}
        </p>
      </motion.div>

      <div className='dopa-cinematic-promise__facts'>
        <span>{t('True pay-as-you-go: pay only for what you use')}</span>
        <span>{t('Fully compatible with 30+ popular everyday tools')}</span>
      </div>
    </section>
  )
}
