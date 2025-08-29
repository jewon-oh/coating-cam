
import { useCallback, useRef, useEffect } from 'react';
import Konva from 'konva';
import { generateFillRects } from '@/lib/coating-line-utils';
import type { CustomShapeConfig } from '@/types/custom-konva-config';

interface CoatingVisualizationManager {
    coatingGroups: Map<string, Konva.Group>;
    badgeGroups: Map<string, Konva.Group>;
    layer: Konva.Layer | null;
    isEnabled: boolean;
}

export function useCoatingVisualization() {
    const managerRef = useRef<CoatingVisualizationManager>({
        coatingGroups: new Map(),
        badgeGroups: new Map(),
        layer: null,
        isEnabled: true
    });

    // 레이어 설정
    const setLayer = useCallback((layer: Konva.Layer) => {
        managerRef.current.layer = layer;
    }, []);

    // 시각화 활성화/비활성화
    const setEnabled = useCallback((enabled: boolean) => {
        const manager = managerRef.current;
        manager.isEnabled = enabled;

        if (!enabled) {
            // 비활성화 시 모든 시각화 숨김
            manager.coatingGroups.forEach(group => group.visible(false));
            manager.badgeGroups.forEach(group => group.visible(false));
        } else {
            // 활성화 시 모든 시각화 표시
            manager.coatingGroups.forEach(group => group.visible(true));
            manager.badgeGroups.forEach(group => group.visible(true));
        }

        manager.layer?.batchDraw();
    }, []);

    // 코팅 라인 그룹 생성/업데이트
    const updateCoatingLines = useCallback((shape: CustomShapeConfig, realTimeProps?: Partial<CustomShapeConfig>) => {
        const manager = managerRef.current;
        if (!manager.layer || !manager.isEnabled || shape.coatingType !== 'fill' || !shape.fillPattern) {
            return;
        }

        const groupId = `coating-${shape.id}`;
        let coatingGroup = manager.coatingGroups.get(groupId);

        // 기존 그룹 제거
        if (coatingGroup) {
            coatingGroup.destroy();
        }

        // 새 그룹 생성
        coatingGroup = new Konva.Group({
            id: groupId,
            listening: false,
        });

        // 실시간 속성이나 기본 속성 사용
        const props = realTimeProps ? { ...shape, ...realTimeProps } : shape;

        // 코팅 라인 생성
        const rects = generateFillRects(
            props,
            shape.lineSpacing || 1,
            shape.coatingWidth || 1
        );

        rects.forEach((rect, index) => {
            const coatingRect = new Konva.Rect({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                fill: '#00bcd4',
                opacity: 0.3,
                listening: false,
                perfectDrawEnabled: false,
            });
            coatingGroup!.add(coatingRect);
        });

        manager.layer.add(coatingGroup);
        manager.coatingGroups.set(groupId, coatingGroup);
    }, []);

    // 배지 그룹 생성/업데이트
    const updateCoatingBadge = useCallback((shape: CustomShapeConfig, stageScale: number = 1, realTimeProps?: Partial<CustomShapeConfig>) => {
        const manager = managerRef.current;
        if (!manager.layer || !manager.isEnabled || !shape.coatingOrder || shape.isLocked || shape.skipCoating) {
            return;
        }

        const groupId = `badge-${shape.id}`;
        let badgeGroup = manager.badgeGroups.get(groupId);

        // 기존 그룹 제거
        if (badgeGroup) {
            badgeGroup.destroy();
        }

        // 새 그룹 생성
        badgeGroup = new Konva.Group({
            id: groupId,
            listening: false,
        });

        const props = realTimeProps ? { ...shape, ...realTimeProps } : shape;
        const badgeSize = 20 / Math.abs(stageScale);
        const fontSize = 12 / Math.abs(stageScale);

        const badge = new Konva.Circle({
            x: (props.x || 0) - badgeSize/2,
            y: (props.y || 0) - badgeSize/2,
            radius: badgeSize/2,
            fill: '#4caf50',
            stroke: '#2e7d32',
            strokeWidth: 1 / Math.abs(stageScale),
            listening: false,
        });

        const text = new Konva.Text({
            x: (props.x || 0) - badgeSize/2,
            y: (props.y || 0) - badgeSize/2,
            width: badgeSize,
            height: badgeSize,
            text: shape.coatingOrder.toString(),
            fontSize: fontSize,
            fontFamily: 'Arial, sans-serif',
            fill: 'white',
            align: 'center',
            verticalAlign: 'middle',
            listening: false,
        });

        badgeGroup.add(badge, text);
        manager.layer.add(badgeGroup);
        manager.badgeGroups.set(groupId, badgeGroup);
    }, []);

    // Konva 노드에서 실시간 속성 추출
    const getKonvaNodeProps = useCallback((shape: CustomShapeConfig, konvaNode: Konva.Shape): Partial<CustomShapeConfig> => {
        return {
            x: konvaNode.x(),
            y: konvaNode.y(),
            width: shape.type === 'circle' ?
                (shape.radius || 0) * 2 * Math.abs(konvaNode.scaleX()) :
                (konvaNode.width() * Math.abs(konvaNode.scaleX())),
            height: shape.type === 'circle' ?
                (shape.radius || 0) * 2 * Math.abs(konvaNode.scaleY()) :
                (konvaNode.height() * Math.abs(konvaNode.scaleY())),
            radius: shape.type === 'circle' ?
                (shape.radius || 0) * Math.abs(konvaNode.scaleX()) :
                shape.radius,
            rotation: konvaNode.rotation(),
            scaleX: konvaNode.scaleX(),
            scaleY: konvaNode.scaleY(),
        };
    }, []);

    // shape과 연결된 Konva 노드로부터 시각화 업데이트
    const updateFromKonvaNode = useCallback((shape: CustomShapeConfig, konvaNode: Konva.Shape, stageScale: number = 1) => {
        const realTimeProps = getKonvaNodeProps(shape, konvaNode);
        updateCoatingLines(shape, realTimeProps);
        updateCoatingBadge(shape, stageScale, realTimeProps);
        managerRef.current.layer?.batchDraw();
    }, [getKonvaNodeProps, updateCoatingLines, updateCoatingBadge]);

    // shape 데이터만으로 시각화 업데이트 (일반적인 경우)
    const updateFromShapeData = useCallback((shape: CustomShapeConfig, stageScale: number = 1) => {
        updateCoatingLines(shape);
        updateCoatingBadge(shape, stageScale);
        managerRef.current.layer?.batchDraw();
    }, [updateCoatingLines, updateCoatingBadge]);

    // 특정 shape의 시각화 제거
    const removeShapeVisualization = useCallback((shapeId: string) => {
        const manager = managerRef.current;

        const coatingGroup = manager.coatingGroups.get(`coating-${shapeId}`);
        if (coatingGroup) {
            coatingGroup.destroy();
            manager.coatingGroups.delete(`coating-${shapeId}`);
        }

        const badgeGroup = manager.badgeGroups.get(`badge-${shapeId}`);
        if (badgeGroup) {
            badgeGroup.destroy();
            manager.badgeGroups.delete(`badge-${shapeId}`);
        }

        manager.layer?.batchDraw();
    }, []);

    // 모든 시각화 제거
    const clearAllVisualizations = useCallback(() => {
        const manager = managerRef.current;

        manager.coatingGroups.forEach(group => group.destroy());
        manager.badgeGroups.forEach(group => group.destroy());
        manager.coatingGroups.clear();
        manager.badgeGroups.clear();

        manager.layer?.batchDraw();
    }, []);

    // 배치 업데이트 (여러 shape 동시 처리)
    const batchUpdate = useCallback((shapes: CustomShapeConfig[], stageScale: number = 1) => {
        shapes.forEach(shape => {
            updateCoatingLines(shape);
            updateCoatingBadge(shape, stageScale);
        });
        managerRef.current.layer?.batchDraw();
    }, [updateCoatingLines, updateCoatingBadge]);

    return {
        setLayer,
        setEnabled,
        updateFromKonvaNode,
        updateFromShapeData,
        removeShapeVisualization,
        clearAllVisualizations,
        batchUpdate,
    };
}