import { useCallback } from 'react';
import Konva from 'konva';
import { CustomShapeConfig } from '@/types/custom-konva-config';

const GUIDELINE_OFFSET = 5;

export type SnapOrientation = 'V' | 'H';
export type SnapKind = 'start' | 'center' | 'end';

export interface SnapGuide {
    lineGuide: number;
    offset: number;
    orientation: SnapOrientation;
    snap: SnapKind;
}
export interface SnapBound {
    guide: number;
    offset: number;
    snap: SnapKind;
}
export interface LineGuideStops {
    vertical: number[];
    horizontal: number[];
}
export interface ItemBounds {
    vertical: SnapBound[];
    horizontal: SnapBound[];
}

type GetStopsOptions = {
    workArea: { width: number; height: number };
    includeGrid?: boolean;
    gridSize?: number;
    // 성능 최적화용: 현재 노드 근처 셀만 포함(선택)
    nearOnly?: boolean;
    nearPadding?: number; // px
};

export function useShapeSnapping() {
    // 1) 스냅 가능한 가이드라인(작업영역 경계/중심 + 그리드 + 다른 도형)
    const getLineGuideStops = useCallback(
        (shapes: CustomShapeConfig[], skipShape: Konva.Node, opts: GetStopsOptions): LineGuideStops => {
            const stage = skipShape.getStage();
            if (!stage) return { vertical: [], horizontal: [] };

            const { workArea, includeGrid, gridSize = 10, nearOnly = true, nearPadding = 800 } = opts;

            // 작업영역 기준 가이드(절대좌표계)
            const vertical: number[] = [0, workArea.width / 2, workArea.width];
            const horizontal: number[] = [0, workArea.height / 2, workArea.height];

            // (선택) 그리드 라인 추가
            if (includeGrid && gridSize > 0) {
                // 성능을 위해 현재 노드 주변만 추가
                const box = skipShape.getClientRect({ relativeTo: stage, skipStroke: true, skipShadow: true });
                const vx1 = Math.max(0, Math.floor((box.x - nearPadding) / gridSize) * gridSize);
                const vx2 = Math.min(workArea.width, Math.ceil((box.x + box.width + nearPadding) / gridSize) * gridSize);
                const vy1 = Math.max(0, Math.floor((box.y - nearPadding) / gridSize) * gridSize);
                const vy2 = Math.min(workArea.height, Math.ceil((box.y + box.height + nearPadding) / gridSize) * gridSize);

                for (let x = nearOnly ? vx1 : 0; x <= (nearOnly ? vx2 : workArea.width); x += gridSize) vertical.push(x);
                for (let y = nearOnly ? vy1 : 0; y <= (nearOnly ? vy2 : workArea.height); y += gridSize) horizontal.push(y);
            }

            // 다른 도형 에지/센터
            for (const shape of shapes) {
                if (shape.id === skipShape.id()) continue;
                const node = stage.findOne(`#${shape.id}`);
                if (!node) continue;

                const box = node.getClientRect({ relativeTo: stage, skipStroke: true, skipShadow: true });

                // X축 반전을 고려하여 시각적인 왼쪽/오른쪽 경계 계산
                const left = Math.min(box.x, box.x + box.width);
                const right = Math.max(box.x, box.x + box.width);
                const top = Math.min(box.y, box.y + box.height);
                const bottom = Math.max(box.y, box.y + box.height);

                vertical.push(left, right, (left + right) / 2);
                horizontal.push(top, bottom, (top + bottom) / 2);
            }


            return { vertical, horizontal };
        },
        []
    );

    // 2) 현재 노드의 스냅 포인트
    const getObjectSnappingEdges = useCallback((node: Konva.Node): ItemBounds => {
        const stage = node.getStage();
        if(stage === null) return { vertical: [], horizontal: [] };
        const box = node.getClientRect({ relativeTo: stage, skipStroke: true, skipShadow: true });
        const absPos = node.absolutePosition();

        // X축 반전을 고려하여 시각적인 왼쪽/오른쪽 경계 계산
        const left = Math.min(box.x, box.x + box.width);
        const right = Math.max(box.x, box.x + box.width);
        const top = Math.min(box.y, box.y + box.height);
        const bottom = Math.max(box.y, box.y + box.height);

        return {
            vertical: [
                { guide: Math.round(left), offset: Math.round(absPos.x - left), snap: 'start' },
                { guide: Math.round((left + right) / 2), offset: Math.round(absPos.x - (left + right) / 2), snap: 'center' },
                { guide: Math.round(right), offset: Math.round(absPos.x - right), snap: 'end' },
            ],
            horizontal: [
                { guide: Math.round(top), offset: Math.round(absPos.y - top), snap: 'start' },
                { guide: Math.round((top + bottom) / 2), offset: Math.round(absPos.y - (top + bottom) / 2), snap: 'center' },
                { guide: Math.round(bottom), offset: Math.round(absPos.y - bottom), snap: 'end' },
            ],
        };
    }, []);


    // 3) 가장 가까운 가이드 선택
    const getGuides = useCallback((stops: LineGuideStops, bounds: ItemBounds): SnapGuide[] => {
        const candV: Array<{ lineGuide: number; diff: number; snap: SnapKind; offset: number }> = [];
        const candH: Array<{ lineGuide: number; diff: number; snap: SnapKind; offset: number }> = [];

        for (const g of stops.vertical) {
            for (const b of bounds.vertical) {
                const diff = Math.abs(g - b.guide);
                if (diff < GUIDELINE_OFFSET) candV.push({ lineGuide: g, diff, snap: b.snap, offset: b.offset });
            }
        }
        for (const g of stops.horizontal) {
            for (const b of bounds.horizontal) {
                const diff = Math.abs(g - b.guide);
                if (diff < GUIDELINE_OFFSET) candH.push({ lineGuide: g, diff, snap: b.snap, offset: b.offset });
            }
        }

        const guides: SnapGuide[] = [];
        const minV = candV.sort((a, b) => a.diff - b.diff)[0];
        const minH = candH.sort((a, b) => a.diff - b.diff)[0];

        if (minV) guides.push({ lineGuide: minV.lineGuide, offset: minV.offset, orientation: 'V', snap: minV.snap });
        if (minH) guides.push({ lineGuide: minH.lineGuide, offset: minH.offset, orientation: 'H', snap: minH.snap });
        return guides;
    }, []);

    // 4) 가이드라인 그리기
    const drawGuides = useCallback((guides: SnapGuide[], layer: Konva.Layer) => {
        for (const lg of guides) {
            const line =
                lg.orientation === 'H'
                    ? new Konva.Line({
                        points: [-6000, 0, 6000, 0],
                        stroke: 'rgb(0, 161, 255)',
                        strokeWidth: 1,
                        name: 'guide-line',
                        dash: [4, 6],
                        listening: false,
                        transformsEnabled: 'position',
                    })
                    : new Konva.Line({
                        points: [0, -6000, 0, 6000],
                        stroke: 'rgb(0, 161, 255)',
                        strokeWidth: 1,
                        name: 'guide-line',
                        dash: [4, 6],
                        listening: false,
                        transformsEnabled: 'position',
                    });
            layer.add(line);
            if (lg.orientation === 'H') line.absolutePosition({ x: 0, y: lg.lineGuide });
            else line.absolutePosition({ x: lg.lineGuide, y: 0 });
        }
    }, []);

    // 5) 가이드 제거
    const clearGuides = useCallback((layer: Konva.Layer) => {
        layer.find('.guide-line').forEach((n) => n.destroy());
    }, []);

    return { getLineGuideStops, getObjectSnappingEdges, getGuides, drawGuides, clearGuides };
}