"use client";

import React, {useEffect, useRef} from 'react';
import {Image, Rect} from 'react-konva';
import type Konva from 'konva';

import type {CustomShapeConfig} from '@/types/custom-konva-config';
import {getCoatingVisualStyle} from "@/lib/shape-style-utils";

interface ImageComponentProps {
    shape: CustomShapeConfig;
    imageElement: HTMLImageElement | null;
    commonProps: any; // makeImageProps의 결과
}

/**
 * Konva Image 도형을 렌더링하는 컴포넌트입니다.
 * 이미지 로딩 상태에 따라 로딩 플레이스홀더 또는 실제 이미지를 렌더링합니다.
 * 필터 적용 시 Konva 노드를 캐시하는 역할도 담당합니다.
 */
export const ImageComponent = ({shape, imageElement, commonProps}: ImageComponentProps) => {
    const imageRef = useRef<Konva.Image>(null);

    // Konva 필터(예: Grayscale)가 적용될 때, 성능을 위해 노드를 캐시해야 합니다.
    // 필터 속성이 변경되거나 이미지가 바뀔 때마다 캐시를 다시 실행하여 뷰를 업데이트합니다.
    useEffect(() => {
        if (imageRef.current) {
            imageRef.current.cache();
        }
    }, [commonProps.filters, imageElement]);

    // 이미지가 로드되지 않았을 경우, 로딩 상태를 나타내는 Rect 플레이스홀더를 렌더링합니다.
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

    // 이미지가 렌더링될 영역을 안전하게 계산합니다. (crop 영역이 이미지 크기를 벗어나지 않도록)
    const safeCrop = shape.crop ? {
        x: Math.max(0, shape.crop.x),
        y: Math.max(0, shape.crop.y),
        width: Math.max(1, Math.min(shape.crop.width, imageElement.width - shape.crop.x)),
        height: Math.max(1, Math.min(shape.crop.height, imageElement.height - shape.crop.y))
    } : {
        x: 0,
        y: 0,
        width: imageElement.width,
        height: imageElement.height
    };

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
            crop={safeCrop}
            {...commonProps}
        />
    );
};