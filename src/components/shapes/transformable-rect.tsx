'use client';

import React, { useRef, useEffect } from 'react';
import { Rect, Transformer } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { RectShape } from '@/contexts/shape-context'; // 타입 경로는 실제 프로젝트에 맞게 조정하세요.

interface RectangleProps {
    shapeProps: RectShape;
    isSelected: boolean;
    onSelect: (e: KonvaEventObject<MouseEvent>)=> void;
    onChange: (newAttrs: Partial<RectShape>) => void;
}

export const TransformableRectangle: React.FC<RectangleProps> = ({ shapeProps, isSelected, onSelect, onChange }) => {
    const shapeRef = useRef<Konva.Rect>(null);
    const trRef = useRef<Konva.Transformer>(null);

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer()?.batchDraw();
        }
    }, [isSelected]);

    const handleTransformEnd = () => {
        const node = shapeRef.current;
        if (!node) return;

        // 변환 후 스케일을 초기화하고, 크기를 직접 업데이트합니다.
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);

        onChange({
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
        });
    };

    return (
        <>
            <Rect
                ref={shapeRef}
                {...shapeProps}
                onClick={onSelect}
                onTap={onSelect}
                onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                    onChange({
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }}
                onTransformEnd={handleTransformEnd}
                stroke={isSelected ? '#f00' : shapeProps.stroke}
                draggable // 선택 도구가 아니어도 드래그 가능하도록 draggable은 항상 true로 설정하고, 상위에서 도구에 따라 제어
            />
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => {
                        // 최소 크기 제한
                        if (newBox.width < 5 || newBox.height < 5) {
                            return oldBox;
                        }
                        return newBox;
                    }}
                />
            )}
        </>
    );
};