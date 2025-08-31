import { useCallback, useRef } from 'react';
import Konva from 'konva';
import { generateFillRects } from '@/lib/coating-line-utils';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import {CoatingSettings, DEFAULT_COATING_SETTINGS} from '@/types/coating';

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

    const setLayer = useCallback((layer: Konva.Layer) => {
        managerRef.current.layer = layer;
    }, []);

    const setEnabled = useCallback((enabled: boolean) => {
        const manager = managerRef.current;
        manager.isEnabled = enabled;
        manager.coatingGroups.forEach(group => group.visible(enabled));
        manager.badgeGroups.forEach(group => group.visible(enabled));
        manager.layer?.batchDraw();
    }, []);

    const applyDefaultCoatingSettings = useCallback((shape: CustomShapeConfig): CustomShapeConfig => {
        return {
            ...shape,
            coatingType: shape.coatingType || 'fill',
            fillPattern: shape.fillPattern || DEFAULT_COATING_SETTINGS.fillPattern,
            coatingWidth: shape.coatingWidth || DEFAULT_COATING_SETTINGS.coatingWidth,
            lineSpacing: shape.lineSpacing || DEFAULT_COATING_SETTINGS.lineSpacing,
        };
    }, []);

    const updateCoatingLines = useCallback(async (
        shape: CustomShapeConfig,
        allShapes: CustomShapeConfig[],
        settings: CoatingSettings,
        realTimeProps?: Partial<CustomShapeConfig>
    ) => {
        const manager = managerRef.current;
        if (!manager.layer || !manager.isEnabled || shape.coatingType !== 'fill' || !shape.fillPattern) {
            return;
        }

        const groupId = `coating-${shape.id}`;
        let coatingGroup = manager.coatingGroups.get(groupId);
        if (coatingGroup) {
            coatingGroup.destroy();
        }

        coatingGroup = new Konva.Group({ id: groupId, listening: false });

        const props = realTimeProps ? { ...shape, ...realTimeProps } : shape;
        const rects = await generateFillRects(props, allShapes, settings);

        const getPatternColor = (pattern: string) => {
            switch (pattern) {
                case 'horizontal': return '#00bcd4';
                case 'vertical': return '#4caf50';
                case 'concentric': return '#ff9800';
                case 'auto': return '#9c27b0';
                default: return '#00bcd4';
            }
        };
        const patternColor = getPatternColor(shape.fillPattern || 'auto');

        rects.forEach(rect => {
            coatingGroup!.add(new Konva.Rect({
                ...rect,
                fill: patternColor,
                opacity: 0.3,
                listening: false,
                perfectDrawEnabled: false,
            }));
        });

        manager.layer.add(coatingGroup);
        manager.coatingGroups.set(groupId, coatingGroup);
    }, []);

    const updateCoatingBadge = useCallback((shape: CustomShapeConfig, stageScale: number = 1, realTimeProps?: Partial<CustomShapeConfig>) => {
        const manager = managerRef.current;
        if (!manager.layer || !manager.isEnabled || !shape.coatingOrder || shape.isLocked || shape.skipCoating) {
            const badgeGroup = manager.badgeGroups.get(`badge-${shape.id}`);
            if (badgeGroup) badgeGroup.destroy();
            return;
        }

        const groupId = `badge-${shape.id}`;
        let badgeGroup = manager.badgeGroups.get(groupId);
        if (badgeGroup) {
            badgeGroup.destroy();
        }

        badgeGroup = new Konva.Group({ id: groupId, listening: false });

        const props = realTimeProps ? { ...shape, ...realTimeProps } : shape;
        const badgeSize = 20 / Math.abs(stageScale);
        const fontSize = 12 / Math.abs(stageScale);

        badgeGroup.add(new Konva.Circle({
            x: (props.x || 0) - badgeSize / 2,
            y: (props.y || 0) - badgeSize / 2,
            radius: badgeSize / 2,
            fill: '#4caf50',
            stroke: '#2e7d32',
            strokeWidth: 1 / Math.abs(stageScale),
        }));

        badgeGroup.add(new Konva.Text({
            x: (props.x || 0) - badgeSize / 2,
            y: (props.y || 0) - badgeSize / 2,
            width: badgeSize,
            height: badgeSize,
            text: shape.coatingOrder.toString(),
            fontSize: fontSize,
            fontFamily: 'Arial, sans-serif',
            fill: 'white',
            align: 'center',
            verticalAlign: 'middle',
        }));

        manager.layer.add(badgeGroup);
        manager.badgeGroups.set(groupId, badgeGroup);
    }, []);

    const getKonvaNodeProps = useCallback((shape: CustomShapeConfig, konvaNode: Konva.Shape): Partial<CustomShapeConfig> => {
        const scaleX = konvaNode.scaleX();
        const scaleY = konvaNode.scaleY();
        return {
            x: konvaNode.x(),
            y: konvaNode.y(),
            width: shape.type === 'circle' ? (shape.radius || 0) * 2 * Math.abs(scaleX) : (konvaNode.width() * Math.abs(scaleX)),
            height: shape.type === 'circle' ? (shape.radius || 0) * 2 * Math.abs(scaleY) : (konvaNode.height() * Math.abs(scaleY)),
            radius: shape.type === 'circle' ? (shape.radius || 0) * Math.abs(scaleX) : shape.radius,
            rotation: konvaNode.rotation(),
            scaleX: scaleX,
            scaleY: scaleY,
        };
    }, []);

    const updateFromKonvaNode = useCallback(async (
        shape: CustomShapeConfig,
        allShapes: CustomShapeConfig[],
        settings: CoatingSettings,
        konvaNode: Konva.Shape,
        stageScale: number = 1
    ) => {
        const realTimeProps = getKonvaNodeProps(shape, konvaNode);
        await updateCoatingLines(shape, allShapes, settings, realTimeProps);
        updateCoatingBadge(shape, stageScale, realTimeProps);
        managerRef.current.layer?.batchDraw();
    }, [getKonvaNodeProps, updateCoatingLines, updateCoatingBadge]);

    const updateFromShapeData = useCallback(async (
        shape: CustomShapeConfig,
        allShapes: CustomShapeConfig[],
        settings: CoatingSettings,
        stageScale: number = 1
    ) => {
        await updateCoatingLines(shape, allShapes, settings);
        updateCoatingBadge(shape, stageScale);
        managerRef.current.layer?.batchDraw();
    }, [updateCoatingLines, updateCoatingBadge]);

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

    const clearAllVisualizations = useCallback(() => {
        const manager = managerRef.current;
        manager.coatingGroups.forEach(group => group.destroy());
        manager.badgeGroups.forEach(group => group.destroy());
        manager.coatingGroups.clear();
        manager.badgeGroups.clear();
        manager.layer?.batchDraw();
    }, []);

    const batchUpdate = useCallback(async (
        shapes: CustomShapeConfig[],
        allShapes: CustomShapeConfig[],
        settings: CoatingSettings,
        stageScale: number = 1
    ) => {
        for (const shape of shapes) {
            await updateCoatingLines(shape, allShapes, settings);
            updateCoatingBadge(shape, stageScale);
        }
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
        applyDefaultCoatingSettings,
    };
}