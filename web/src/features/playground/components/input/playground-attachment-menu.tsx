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
  CameraIcon,
  FileIcon,
  ImageIcon,
  MonitorUpIcon,
  PaperclipIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInputButton,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  buildTextFileSnippet,
  captureScreenshotFile,
  isCameraCaptureSupported,
  isImageFile,
  isScreenCaptureSupported,
  isTextLikeFile,
  readTextFile,
} from '../../lib'
import { PlaygroundCameraDialog } from './playground-camera-dialog'

type PlaygroundAttachmentMenuProps = {
  disabled?: boolean
  /**
   * Inlines the content of a text document into the prompt. Playground models
   * only consume images as binary parts, so text files are appended as text.
   */
  onAppendText: (snippet: string) => void
}

export function PlaygroundAttachmentMenu(props: PlaygroundAttachmentMenuProps) {
  const { t } = useTranslation()
  const attachments = usePromptInputAttachments()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const handleScreenshot = async () => {
    if (!isScreenCaptureSupported()) {
      toast.error(t('Screen capture is not supported in this browser'))
      return
    }

    try {
      const file = await captureScreenshotFile()
      attachments.add([file])
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        return
      }
      toast.error(t('Could not take the screenshot, please try again'))
    }
  }

  const handleCamera = () => {
    if (!isCameraCaptureSupported()) {
      toast.error(t('Camera is not supported in this browser'))
      return
    }
    setCameraOpen(true)
  }

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList?.length) return

    const files = [...fileList]
    const images = files.filter((file) => isImageFile(file))
    if (images.length > 0) {
      attachments.add(images)
    }

    const textFiles = files.filter(
      (file) => !isImageFile(file) && isTextLikeFile(file)
    )
    for (const file of textFiles) {
      const content = await readTextFile(file)
      props.onAppendText(buildTextFileSnippet(file.name, content))
    }

    const rejected = files.length - images.length - textFiles.length
    if (rejected > 0) {
      toast.error(t('Only images and text documents are supported'))
    }
  }

  return (
    <>
      <input
        accept='image/*,text/*,.csv,.json,.log,.md,.markdown,.sql,.txt,.xml,.yaml,.yml'
        aria-label={t('Upload file')}
        className='hidden'
        multiple
        onChange={(event) => {
          void handleFilesSelected(event.target.files)
          event.target.value = ''
        }}
        ref={fileInputRef}
        type='file'
      />

      <DropdownMenu modal={false}>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <PromptInputButton
                    aria-label={t('Add attachment')}
                    className='text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium'
                    disabled={props.disabled}
                    variant='ghost'
                  />
                }
              >
                <PaperclipIcon size={16} />
              </DropdownMenuTrigger>
            }
          />
          <TooltipContent>
            <p>{t('Add attachment')}</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align='start' side='top'>
          <DropdownMenuItem onClick={() => attachments.openFileDialog()}>
            <ImageIcon className='size-4' />
            {t('Upload photo')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <FileIcon className='size-4' />
            {t('Upload file')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleScreenshot()}>
            <MonitorUpIcon className='size-4' />
            {t('Take screenshot')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCamera}>
            <CameraIcon className='size-4' />
            {t('Take photo')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PlaygroundCameraDialog
        onCapture={(file) => attachments.add([file])}
        onOpenChange={setCameraOpen}
        open={cameraOpen}
      />
    </>
  )
}
