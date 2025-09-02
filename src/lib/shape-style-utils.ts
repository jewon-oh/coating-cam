import {CustomShapeConfig} from "@/types/custom-konva-config";
import Konva from "konva";

/**
 * 도형의 상태(잠김, 코팅 건너뛰기, 코팅 타입)에 따라 시각적 스타일 객체를 반환합니다.
 * @param shape - 스타일을 결정할 도형 객체
 * @returns Konva 도형에 적용할 스타일 속성 객체
 */
export const getCoatingVisualStyle = (shape: Partial<CustomShapeConfig>): Konva.ShapeConfig => {
    const isLocked = shape.isLocked;

    if (isLocked) {
        return {
            fill: shape.fill,
            stroke: shape.stroke,
            strokeWidth: shape.strokeWidth,
            dash: [4, 4],
            opacity: 0.6
        };
    }

    if (shape.skipCoating) {
        return {
            fill: shape.fill || '#f8f9fa',
            stroke: '#6c757d',
            strokeWidth: 1,
            dash: [8, 4],
            opacity: 0.5
        };
    }

    switch (shape.coatingType) {
        case 'fill':
            return {
                fill: '#2196f3', // 패턴으로 대체되지만, fallback으로 사용
                stroke: '#2196f3',
                strokeWidth: 2,
                opacity: shape.type === 'image' ? 1 : 0.5,
                shadowColor: '#2196f3',
                shadowBlur: 5,
                shadowOpacity: 0.3
            };
        case 'outline':
            return {
                fill: 'transparent',
                stroke: '#ff9800',
                strokeWidth: 3,
                opacity: 1,
                shadowColor: '#ff9800',
                shadowBlur: 8,
                shadowOpacity: 0.4
            };
        case 'masking':
            return {
                fill: '#f44336',
                stroke: '#f44336',
                strokeWidth: 2,
                dash: [6, 3],
                opacity: shape.type === 'image' ? 1 : 0.6,
                shadowColor: '#f44336',
                shadowBlur: 4,
                shadowOpacity: 0.2
            };
        default:
            return {
                fill: shape.fill || '#e9ecef',
                stroke: '#6c757d',
                strokeWidth: 1,
                opacity: 1
            };
    }
};