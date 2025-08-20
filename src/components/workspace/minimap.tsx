// minimap.tsx

import { motion } from "framer-motion";
import { AnyNodeConfig } from "@/types/custom-konva-config";
import React from "react";

// 1. Props 타입을 명확하게 정의합니다.
// stage의 scaleX, scaleY, width, height를 모두 받도록 변경합니다.
interface MinimapProps {
    shapes: AnyNodeConfig[];
    viewport: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        width: number;
        height: number;
    };
    workArea: { width: number; height: number };
    onViewportChange?: (x: number, y: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({ shapes, viewport, workArea }) => {
    // 미니맵 내부의 작업 영역 스타일 (전체 크기의 80% x 70%)
    const mapAreaStyle = {
        left: '10%',
        top: '10%',
        width: '80%',
        height: '70%',
    };

    // 2. 도형 위치 계산 로직 수정
    const shapeElements = shapes.filter(s => s.visible !== false).map(shape => {
        // 축 반전(scale < 0) 여부를 확인합니다.
        const isFlippedX = viewport.scaleX < 0;
        const isFlippedY = viewport.scaleY < 0;

        // 반전 상태에 따라 좌표를 정규화합니다.
        const normalizedX = isFlippedX ? workArea.width - (shape.x ?? 0) : (shape.x ?? 0);
        const normalizedY = isFlippedY ? workArea.height - (shape.y ?? 0) : (shape.y ?? 0);

        const style: React.CSSProperties = {
            left: `${(normalizedX / workArea.width) * 100}%`,
            top: `${(normalizedY / workArea.height) * 100}%`,
            width: '2px',
            height: '2px',
        };

        return (
            <div
                key={shape.id}
                className="absolute bg-blue-500 opacity-60 rounded-sm"
                style={style}
            />
        );
    });

    // 3. 뷰포트 위치 및 크기 계산 로직 수정
    const absScaleX = Math.abs(viewport.scaleX);
    const absScaleY = Math.abs(viewport.scaleY);

    // 뷰포트의 크기 (캔버스 크기 / 줌 배율)
    const viewWidthOnCanvas = viewport.width / absScaleX;
    const viewHeightOnCanvas = viewport.height / absScaleY;

    // 뷰포트의 좌상단 좌표 (스테이지 좌표와 스케일을 이용해 역산)
    const viewX = -viewport.x / viewport.scaleX;
    const viewY = -viewport.y / viewport.scaleY;

    // 뷰포트 크기를 미니맵 작업 영역에 대한 비율로 변환
    const viewportStyle: React.CSSProperties = {
        width: `${(viewWidthOnCanvas / workArea.width) * 100}%`,
        height: `${(viewHeightOnCanvas / workArea.height) * 100}%`,
        // 뷰포트 위치도 축 반전을 고려하여 정규화
        left: `${((viewport.scaleX < 0 ? workArea.width - viewX : viewX) / workArea.width) * 100}%`,
        top: `${((viewport.scaleY < 0 ? workArea.height - viewY : viewY) / workArea.height) * 100}%`,
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 right-4 w-48 h-36 bg-white/90 backdrop-blur-sm rounded-lg border shadow-lg overflow-hidden cursor-pointer"
        >
            <div className="relative w-full h-full">
                <div
                    className="absolute bg-gray-100"
                    style={mapAreaStyle}
                >
                    {/* 작업 영역 테두리 */}
                    <div className="absolute inset-0 border border-gray-400" />

                    {/* 도형들 렌더링 */}
                    {shapeElements}

                    {/* 현재 뷰포트 표시 */}
                    <div
                        className="absolute border-2 border-red-500 bg-red-500/20"
                        style={viewportStyle}
                    />
                </div>
            </div>
        </motion.div>
    );
};