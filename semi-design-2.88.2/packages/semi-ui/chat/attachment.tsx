import React from "react";
import { FileItem } from '../upload/interface';
import Image from '../image';
import { IconAlertCircle, IconBriefStroked, IconClear } from '@douyinfe/semi-icons';
import { strings, cssClasses } from '@douyinfe/semi-foundation/chat/constants';
import cls from 'classnames';
import { Progress } from "../index";

const { PREFIX_ATTACHMENT, } = cssClasses;
const { PIC_SUFFIX_ARRAY, PIC_PREFIX } = strings;

interface AttachmentProps {
    className?: string;
    attachment?: FileItem[];
    onClear?: (item: FileItem) => void;
    showClear?: boolean
}

interface FileProps {
    url?: string;
    name?: string;
    size?: string;
    type?: string
}

export const FileAttachment = React.memo((props: FileProps) => {
    const { url, name, size, type } = props;
    return <a
        href={url}
        target="_blank"
        className={`${PREFIX_ATTACHMENT}-file`} rel="noreferrer"
    >
        <IconBriefStroked size="extra-large" className={`${PREFIX_ATTACHMENT}-file-icon`}/>
        <div className={`${PREFIX_ATTACHMENT}-file-info`}>
            <span className={`${PREFIX_ATTACHMENT}-file-title`}>{name}</span>
            <span className={`${PREFIX_ATTACHMENT}-file-metadata`}>
                <span className={`${PREFIX_ATTACHMENT}-file-type`}>{type}</span>
                {type ? ' · ' : ''}{size}
            </span>
        </div>
    </a>;
});

export const ImageAttachment = React.memo((props: {src: string}) => {
    const { src } = props;
    return <Image
        className={`${PREFIX_ATTACHMENT}-img`}
        width={60}
        height={60}
        src={src}
    />;
});

const Attachment = React.memo((props: AttachmentProps) => {
    const { attachment, onClear, showClear = true, className } = props;

    return (
        <div 
            className={cls(PREFIX_ATTACHMENT, { [className]: className })}
        >
            {
                attachment.map(item => {
                    const { percent, status } = item;
                    const suffix = item?.name.split('.').pop();
                    const isImg = item?.fileInstance?.type?.startsWith(PIC_PREFIX) || PIC_SUFFIX_ARRAY.includes(suffix);
                    const realType = suffix ?? item?.fileInstance?.type?.split('/').pop();
                    const showProcess = !(percent === 100 || typeof percent === 'undefined') && status === strings.FILE_STATUS.UPLOADING;
                    return <div 
                        className={`${PREFIX_ATTACHMENT}-item`}
                        key={item.uid}
                    >
                        {isImg ? (
                            <ImageAttachment src={item.url} />
                        ) : (
                            <FileAttachment
                                url={item.url}
                                name={item.name}
                                size={item.size}
                                type={realType}
                            />
                        )}
                        {showClear && <IconClear 
                            size="large" 
                            className={`${PREFIX_ATTACHMENT}-clear`}
                            onClick={() => {
                                onClear && onClear(item);
                            }}
                        />}
                        {showProcess && <Progress percent={percent} type="circle" size="small" width={30} className={`${PREFIX_ATTACHMENT}-process`} aria-label="upload progress" />}
                        {[strings.FILE_STATUS.UPLOAD_FAIL, strings.FILE_STATUS.VALID_FAIL].includes(status) && <IconAlertCircle className={`${PREFIX_ATTACHMENT}-fail`} />}
                    </div>;
                })
            }
        </div>
    );  
});

export default Attachment;
