'use client';

import React, { useRef, useEffect } from 'react';
import { Image, Transformer } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import useImage from "use-image";

import { ImageShape } from '@/contexts/shape-context';

interface ImageProps {
    shapeProps: ImageShape;
    isSelected: boolean;
    onSelect: (e: KonvaEventObject<MouseEvent>)=> void;
    onChange: (newAttrs: Partial<ImageShape>) => void;
    listening: boolean;
}

export const TransformableImage: React.FC<ImageProps> = ({
    shapeProps, isSelected, onSelect, onChange, listening
}) => {
    const shapeRef = useRef<Konva.Image>(null);
    const trRef = useRef<Konva.Transformer>(null);
    const [image] = useImage(shapeProps.src!);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    const handleTransformStart = () => {
        const node = shapeRef.current;
        if (node) {
            transformStartCache.current = {
                width: node.width(),
                height: node.height(),
                crop: node.crop(),
            };
        }
    };

    const handleTransform = (e: KonvaEventObject<Event>) => {
        const node = shapeRef.current;
        const transformer = trRef.current;

        if (node && transformer && image) {
            const anchor = transformer.getActiveAnchor();
            const isCropping = ['top-center', 'middle-right', 'bottom-center', 'middle-left'].includes(anchor);

            if (isCropping) {
                const oldCrop = transformStartCache.current.crop || { x: 0, y: 0, width: image.width, height: image.height };
                const newCrop = { ...oldCrop };

                const size = {
                    width: node.width() * node.scaleX(),
                    height: node.height() * node.scaleY(),
                }
                node.scaleX(1);
                node.scaleY(1);

                const lastSize = transformStartCache.current;

                if (anchor.includes('right')) {
                    newCrop.width = size.width / lastSize.width * oldCrop.width;
                } else if (anchor.includes('left')) {
                    newCrop.x = oldCrop.x + oldCrop.width - size.width / lastSize.width * oldCrop.width;
                    newCrop.width = size.width / lastSize.width * oldCrop.width;
                }

                if (anchor.includes('bottom')) {
                    newCrop.height = size.height / lastSize.height * oldCrop.height;
                } else if (anchor.includes('top')) {
                    newCrop.y = oldCrop.y + oldCrop.height - size.height / lastSize.height * oldCrop.height;
                    newCrop.height = size.height / lastSize.height * oldCrop.height;
                }

                onChange({
                    ...shapeProps,
                    crop: newCrop,
                    width: size.width,
                    height: size.height,
                    scaleX: 1,
                    scaleY: 1,
                });
            }
        }
    };

    const handleTransformEnd = (e: KonvaEventObject<Event>) => {
        const node = shapeRef.current;
        const transformer = trRef.current;
        if (node && transformer) {
            const anchor = transformer.getActiveAnchor();
            const isCropping = ['top-center', 'middle-right', 'bottom-center', 'middle-left'].includes(anchor);

            if (!isCropping) {
                onChange({
                    ...shapeProps,
                    x: node.x(),
                    y: node.y(),
                    width: node.width(),
                    height: node.height(),
                    scaleX: 1,
                    scaleY: 1,
                    rotation: node.rotation(),
                    crop: node.crop(),
                });
            }
        }
        transformStartCache.current = null;
    };

    return (
        <>
            <Image
                ref={shapeRef}
                {...shapeProps}
                image={image}
                listening={listening}
                onClick={onSelect}
                onTap={onSelect}
                onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
                onTransformStart={handleTransformStart}
                onTransform={handleTransform}
                onTransformEnd={handleTransformEnd}
                stroke={isSelected ? '#f00' : shapeProps.stroke}
                strokeScaleEnabled={false}
                draggable
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    rotateEnabled={true}
                    anchorSize={10}
                    anchorStroke="#3b82f6"
                    anchorFill="#fff"
                    borderStroke="#3b82f6"
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'middle-right', 'bottom-center', 'middle-left']}
                    // 핸들에 따라 비율 유지 여부 동적 변경
                    anchorDragBoundFunc={(oldPos, newPos, e) => {
                        const anchorName = e.target.name();
                        const isCropping = ['top-center', 'middle-right', 'bottom-center', 'middle-left'].includes(anchorName);
                        trRef.current?.keepRatio(!isCropping);
                        return newPos;
                    }}
                />
            )}
        </>
    );
};