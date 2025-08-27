// src/hooks/use-shape-drawing.tsx
import React, { useCallback, useRef } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { addShape } from '@/store/slices/shapes-slice';
import { setPresent } from '@/store/slices/history-slice';
import { setTool } from '@/store/slices/tool-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { useSettings } from '@/contexts/settings-context';

type DrawingTool = 'circle' | 'rectangle';

export function useShapeDrawing() {
    const dispatch = useAppDispatch();
    const { shapes } = useAppSelector((state) => state.shapes);
    const { tool, coatingType, fillPattern } = useAppSelector((state) => state.tool);
    const { isSnappingEnabled, gridSize, gcodeSettings } = useSettings();

    // 그리기 상태
    const isDrawingRef = useRef(false);
    const drawStartClientRef = useRef<{ x: number; y: number } | null>(null);
    const tempShapeRef = useRef<Konva.Shape | null>(null);
    const tempTypeRef = useRef<DrawingTool | null>(null);

    // 유틸리티 함수들
    const getPointerClient = useCallback((stage: Konva.Stage) => stage.getPointerPosition() || null, []);
    const toStagePoint = useCallback((stage: Konva.Stage, client: { x: number; y: number }) => {
        const t = stage.getAbsoluteTransform().copy().invert();
        return t.point(client);
    }, []);

    const snap = useCallback(
        (v: number) => (isSnappingEnabled ? Math.round(v / gridSize) * gridSize : v),
        [isSnappingEnabled, gridSize]
    );
    const snapPoint = useCallback(
        (p: { x: number; y: number }) => ({ x: snap(p.x), y: snap(p.y) }),
        [snap]
    );

    // 임시 도형 관리
    const createTempShape = useCallback((type: DrawingTool, layer: Konva.Layer, x: number, y: number) => {
        if (tempShapeRef.current) {
            tempShapeRef.current.destroy();
            tempShapeRef.current = null;
        }
        tempTypeRef.current = type;

        const common = {
            id: '__temp-shape__',
            x,
            y,
            fill: 'rgba(59,130,246,0.2)',
            stroke: '#3b82f6',
            strokeWidth: 2,
            listening: false,
        } as const;

        let temp: Konva.Shape;
        if (type === 'circle') {
            temp = new Konva.Circle({ ...common, radius: 0 });
        } else {
            temp = new Konva.Rect({ ...common, width: 0, height: 0 });
        }
        layer.add(temp);
        tempShapeRef.current = temp;
        layer.batchDraw();
    }, []);

    const updateTempShape = useCallback(
        (startPoint: { x: number; y: number }, endPoint: { x: number; y: number }) => {
            const temp = tempShapeRef.current;
            if (!temp) return;

            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            const lineSpacing = gcodeSettings.lineSpacing;

            if (coatingType === "fill") {
                let snappedWidth = dx;
                let snappedHeight = dy;

                if (fillPattern === 'horizontal') {
                    snappedHeight = Math.round(dy / lineSpacing) * lineSpacing;
                } else if (fillPattern === 'vertical') {
                    snappedWidth = Math.round(dx / lineSpacing) * lineSpacing;
                } else {
                    snappedWidth = Math.round(dx / lineSpacing) * lineSpacing;
                    snappedHeight = Math.round(dy / lineSpacing) * lineSpacing;
                }

                const x = Math.min(startPoint.x, startPoint.x + snappedWidth);
                const y = Math.min(startPoint.y, startPoint.y + snappedHeight);
                const width = Math.abs(snappedWidth);
                const height = Math.abs(snappedHeight);

                if (temp instanceof Konva.Rect) {
                    temp.position({ x, y });
                    temp.size({ width, height });
                } else if (temp instanceof Konva.Circle) {
                    const rawRadius = Math.sqrt(snappedWidth * snappedWidth + snappedHeight * snappedHeight);
                    const snappedRadius = Math.round(rawRadius / lineSpacing) * lineSpacing;
                    temp.position({ x: startPoint.x, y: startPoint.y });
                    temp.radius(snappedRadius);
                }
            } else {
                if (temp instanceof Konva.Rect) {
                    temp.position({
                        x: Math.min(startPoint.x, endPoint.x),
                        y: Math.min(startPoint.y, endPoint.y),
                    });
                    temp.width(Math.abs(dx));
                    temp.height(Math.abs(dy));
                } else if (temp instanceof Konva.Circle) {
                    const radius = Math.sqrt(dx * dx + dy * dy);
                    temp.position({ x: startPoint.x, y: startPoint.y });
                    temp.radius(radius);
                }
            }
            temp.getLayer()?.batchDraw();
        },
        [coatingType, fillPattern, gcodeSettings.lineSpacing]
    );

    const destroyTempShape = useCallback(() => {
        if (tempShapeRef.current) {
            tempShapeRef.current.destroy();
            tempShapeRef.current = null;
        }
        tempTypeRef.current = null;
    }, []);

    // 그리기 이벤트 핸들러들
    const startDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        console.log('🎨 startDrawing called', {
            tool,
            targetName: e.target.name(),
            targetConstructor: e.target.constructor.name,
            isStage: e.target === e.target.getStage()
        });

        // 그리기 도구가 아닌 경우 early return
        if (!(tool === 'circle' || tool === 'rectangle')) {
            console.log('❌ Not a drawing tool:', tool);
            return false;
        }

        const stage = e.target.getStage();
        if (!stage) {
            console.log('❌ No stage found');
            return false;
        }

        // Stage나 배경 요소를 클릭했을 때만 그리기 시작
        const isValidTarget = e.target === stage ||
            e.target.name() === '' ||
            !e.target.listening() ||
            e.target.id() === '';

        if (!isValidTarget) {
            console.log('❌ Invalid target for drawing:', {
                isStage: e.target === stage,
                name: e.target.name(),
                listening: e.target.listening(),
                id: e.target.id()
            });
            return false;
        }

        // 가장 상위 레이어 찾기 (Shape 레이어가 아닌 배경 레이어)
        const layers = stage.getLayers();
        const drawingLayer = layers.find(layer => !layer.name() || layer.name() === '') || layers[0];

        if (!drawingLayer) {
            console.log('❌ No drawing layer found');
            return false;
        }

        const client = getPointerClient(stage);
        if (!client) {
            console.log('❌ No client position');
            return false;
        }

        console.log('✅ Starting drawing', { tool, client });
        isDrawingRef.current = true;
        drawStartClientRef.current = client;
        const sp = snapPoint(toStagePoint(stage, client));
        createTempShape(tool, drawingLayer, sp.x, sp.y);
        return true;
    }, [tool, getPointerClient, snapPoint, toStagePoint, createTempShape]);

    const updateDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawingRef.current || !drawStartClientRef.current) return false;
        if (!(tool === 'circle' || tool === 'rectangle')) return false;

        const stage = e.target.getStage();
        if (!stage) return false;

        const cur = getPointerClient(stage);
        if (!cur) return false;

        const s = toStagePoint(stage, drawStartClientRef.current);
        const c = toStagePoint(stage, cur);
        updateTempShape(s, c);
        return true;
    }, [tool, getPointerClient, toStagePoint, updateTempShape]);

    const finishDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawingRef.current || !drawStartClientRef.current) return false;
        if (!(tool === 'circle' || tool === 'rectangle')) return false;

        const stage = e.target.getStage();
        if (!stage) return false;

        const endClient = getPointerClient(stage);
        const startClient = drawStartClientRef.current;

        isDrawingRef.current = false;
        drawStartClientRef.current = null;
        destroyTempShape();

        if (!endClient) {
            dispatch(setTool('select'));
            return true;
        }

        const dist = Math.hypot(endClient.x - startClient.x, endClient.y - startClient.y);
        if (dist > 3) {
            const s = snapPoint(toStagePoint(stage, startClient));
            const ept = snapPoint(toStagePoint(stage, endClient));

            let newShape: CustomShapeConfig;

            if (tool === 'rectangle') {
                const x = Math.min(s.x, ept.x);
                const y = Math.min(s.y, ept.y);
                const width = Math.abs(ept.x - s.x);
                const height = Math.abs(ept.y - s.y);

                newShape = {
                    id: crypto.randomUUID(),
                    parentId: null,
                    type: 'rectangle',
                    name: '사각형',
                    x, y, width, height,
                    fill: 'rgba(59,130,246,0.5)',
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    listening: false,
                    visible: true,
                    isLocked: false,
                    coatingType: coatingType,
                    fillPattern: fillPattern
                };
            } else { // circle
                const dx = ept.x - s.x;
                const dy = ept.y - s.y;
                const radius = Math.sqrt(dx * dx + dy * dy);

                newShape = {
                    id: crypto.randomUUID(),
                    parentId: null,
                    type: 'circle',
                    name: '원형',
                    x: s.x,
                    y: s.y,
                    radius: radius,
                    fill: 'rgba(59,130,246,0.5)',
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    listening: false,
                    visible: true,
                    isLocked: false,
                    coatingType: coatingType,
                    fillPattern: fillPattern
                };
            }

            const next = [...shapes, newShape] as CustomShapeConfig[];
            dispatch(addShape(newShape));
            dispatch(setPresent(next));
            console.log('✅ Shape created:', newShape);
        }

        dispatch(setTool('select'));
        return true;
    }, [tool, getPointerClient, toStagePoint, snapPoint, destroyTempShape, dispatch, shapes, coatingType, fillPattern]);

    const cancelDrawing = useCallback(() => {
        if (isDrawingRef.current) {
            isDrawingRef.current = false;
            drawStartClientRef.current = null;
            destroyTempShape();
        }
    }, [destroyTempShape]);

    return {
        isDrawing: isDrawingRef.current,
        startDrawing,
        updateDrawing,
        finishDrawing,
        cancelDrawing,
    };
}