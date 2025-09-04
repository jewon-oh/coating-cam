"use client";

import React, {useEffect, useRef} from 'react';
import {Image, Rect} from 'react-konva';
import type Konva from 'konva';

import type {CustomShapeConfig} from '@/types/custom-konva-config';
import {getCoatingVisualStyle} from "@/lib/shape-style-utils";

import {KonvaEventObject} from "konva/lib/Node";

interface ImageComponentProps {
    shape: CustomShapeConfig;
    imageElement: HTMLImageElement | null;
    commonProps: Partial<Konva.ImageConfig> & {
        onDragStart?: (e: KonvaEventObject<DragEvent>) => void;
        onDragEnd?: (e: KonvaEventObject<DragEvent>) => void;
        onTransformEnd?: (e: KonvaEventObject<Event>) => void;
    };
}

/**
 * Konva Image 도형을 렌더링하는 컴포넌트입니다.
 */
export const ImageComponent = ({shape, imageElement, commonProps}: ImageComponentProps) => {
    const imageRef = useRef<Konva.Image>(null);

    useEffect(() => {
        if (imageRef.current && commonProps.filters) {
            imageRef.current.cache();
        }
    }, [commonProps.filters, imageElement]);

    if (!imageElement) {
        const style = getCoatingVisualStyle(shape);
        return (
            <Rect
                key={`${shape.id}-loading`}
                id={shape.id}
                name="shape"
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                fill={style.fill || "#f8f9fa"}
                stroke={style.stroke || "#dee2e6"}
                strokeWidth={style.strokeWidth || 1}
                dash={style.dash || [4, 4]}
                opacity={style.opacity || 0.5}
                draggable={false}
                listening={false}
            />
        );
    }

    // ✨ FIX: crop 속성을 shape 데이터에서 직접 사용하고, 없을 경우에만 fallback 처리합니다.
    const cropConfig = shape.crop && shape.crop.width > 0 && shape.crop.height > 0
        ? shape.crop
        : undefined; // crop 데이터가 유효하지 않으면 undefined를 전달하여 전체 이미지를 표시합니다.


    return (
        <Image
            ref={imageRef}
            key={shape.id}
            id={shape.id}
            alt={shape.name}
            name="shape"
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            image={imageElement}
            rotation={shape.rotation || 0}
            scaleX={shape.scaleX || 1}
            scaleY={shape.scaleY || 1}
            crop={cropConfig} // 수정된 crop 설정을 적용합니다.
            {...commonProps}
        />
    );
};
