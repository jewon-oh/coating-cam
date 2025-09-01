"use client";

import React, { useMemo } from 'react';
import { Circle, Line, Rect } from 'react-konva';

import type { CustomShapeConfig } from '@/types/custom-konva-config';
import {createCoatingPatternCanvas} from "@/lib/shape-create-utils";

interface ShapeComponentProps {
    shape: CustomShapeConfig;
    commonProps: Partial<CustomShapeConfig>;
}

/**
 * 개별 도형(Rect, Circle, Line 등)을 렌더링하는 컴포넌트입니다.
 * 도형의 종류에 따라 적절한 Konva 컴포넌트를 렌더링하고,
 * fill 패턴 생성 및 실시간 변환 핸들링을 담당합니다.
 */
export const ShapeComponent = ({ shape, commonProps }: ShapeComponentProps) => {
    const patternImage = useMemo(() => {
        if (shape.coatingType !== 'fill' || !shape.fillPattern) {
            return undefined;
        }

        if (shape.type === 'rectangle') {
            return createCoatingPatternCanvas(
                'rectangle',
                shape.width,
                shape.height,
                shape.lineSpacing || 0,
                shape.coatingWidth || 0,
                shape.fillPattern,
            );
        }
        if (shape.type === 'circle' && shape.radius > 0) {
            const size = shape.radius * 2;
            return createCoatingPatternCanvas(
                'circle',
                size,
                size,
                shape.lineSpacing || 0,
                shape.coatingWidth || 0,
                shape.fillPattern,
            );
        }
        return undefined;
    }, [
        shape.width, shape.height, shape.radius,
        shape.lineSpacing, shape.coatingWidth, shape.fillPattern,
        shape.coatingType, shape.type
    ]);

    const finalProps = { ...commonProps };

    if (shape.coatingType === 'fill' && patternImage) {
        finalProps.fillPatternImage = patternImage;
        finalProps.fillPatternRepeat = 'no-repeat';
        finalProps.fill = undefined;

        // ✨✨✨ 최종 수정 ✨✨✨
        // 변형 중에 직접 제어되었던 fillPatternScale 값을
        // React 렌더링 사이클에서 명시적으로 올바르게 초기화합니다.
        // 변형이 끝난 도형의 스케일은 항상 1이므로, 패턴 스케일도 1로 설정합니다.
        finalProps.fillPatternScale = { x: 1, y: 1 };

        if (shape.type === 'circle') {
            finalProps.fillPatternOffset = { x: shape.radius, y: shape.radius };
        }
    } else if (shape.coatingType === 'outline') {
        finalProps.fill = 'transparent';
    }

    switch (shape.type) {
        case 'rectangle':
            return <Rect {...shape} {...finalProps} strokeScaleEnabled={false} />;
        case 'circle':
            return <Circle {...shape} {...finalProps} strokeScaleEnabled={false} />;
        case 'line':
            return <Line {...shape} {...commonProps} strokeScaleEnabled={false} />;
        default:
            return null;
    }
};