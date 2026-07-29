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
'use client'

import { MicIcon } from 'lucide-react'
import {
  type ComponentProps,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { cn } from '@/lib/utils'

import { PromptInputButton } from './prompt-input-controls'

interface SpeechRecognitionEventMap {
  start: Event
  end: Event
  result: SpeechRecognitionEvent
  error: SpeechRecognitionErrorEvent
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  addEventListener<K extends keyof SpeechRecognitionEventMap>(
    type: K,
    listener: (
      this: SpeechRecognition,
      ev: SpeechRecognitionEventMap[K]
    ) => void
  ): void
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

type SpeechRecognitionResultList = {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

type SpeechRecognitionResult = {
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

type SpeechRecognitionAlternative = {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new (): SpeechRecognition
    }
  }
}

export type PromptInputSpeechButtonProps = ComponentProps<
  typeof PromptInputButton
> & {
  textareaRef?: RefObject<HTMLTextAreaElement | null>
  onTranscriptionChange?: (text: string) => void
}

export const PromptInputSpeechButton = ({
  className,
  textareaRef,
  onTranscriptionChange,
  ...props
}: PromptInputSpeechButtonProps) => {
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition
      const speechRecognition = new SpeechRecognition()

      speechRecognition.continuous = true
      speechRecognition.interimResults = true
      speechRecognition.lang = 'en-US'

      speechRecognition.addEventListener('start', () => {
        setIsListening(true)
      })

      speechRecognition.addEventListener('end', () => {
        setIsListening(false)
      })

      speechRecognition.addEventListener('result', (event) => {
        let finalTranscript = ''

        // eslint-disable-next-line unicorn/prefer-spread -- SpeechRecognitionResultList is array-like, not iterable
        const results = Array.from(event.results)

        for (const result of results) {
          if (result.isFinal) {
            finalTranscript += result[0]?.transcript ?? ''
          }
        }

        if (finalTranscript && textareaRef?.current) {
          const textarea = textareaRef.current
          const currentValue = textarea.value
          const newValue =
            currentValue + (currentValue ? ' ' : '') + finalTranscript

          textarea.value = newValue
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
          onTranscriptionChange?.(newValue)
        }
      })

      speechRecognition.addEventListener('error', (event) => {
        // eslint-disable-next-line no-console
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      })

      recognitionRef.current = speechRecognition
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecognition(speechRecognition)
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [textareaRef, onTranscriptionChange])

  const toggleListening = useCallback(() => {
    if (!recognition) {
      return
    }

    if (isListening) {
      recognition.stop()
    } else {
      recognition.start()
    }
  }, [recognition, isListening])

  return (
    <PromptInputButton
      className={cn(
        'relative transition-ui duration-200',
        isListening && 'bg-accent text-accent-foreground animate-pulse',
        className
      )}
      disabled={!recognition}
      onClick={toggleListening}
      {...props}
    >
      <MicIcon className='size-4' />
    </PromptInputButton>
  )
}
