import { useCallback, useRef } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { addShape } from '@/store/slices/shape-slice';
import { setTool } from '@/store/slices/tool-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { DRAWING_TOOLS, ToolType } from "@/types/tool-type";
import { useShapeSnapping } from './use-shape-snapping';
import {createCoatingPatternCanvas} from "@/lib/shape-create-utils";



export function useShapeDrawing() {
    const dispatch = useAppDispatch();
    const toolState = useAppSelector((state) => state.tool);
    const { snapPointToGrid, snapShapeSize, snapCircleRadius } = useShapeSnapping();

    // 그리기 상태
    const isDrawingRef = useRef(false);
    const drawStartClientRef = useRef<{ x: number; y: number } | null>(null);
    const drawStartStageRef = useRef<{ x: number; y: number } | null>(null); // Stage 좌표 저장
    const tempShapeRef = useRef<Konva.Shape | null>(null);
    const tempTypeRef = useRef<ToolType | null>(null);

    // 유틸리티 함수들
    const getPointerClient = useCallback((stage: Konva.Stage) => stage.getPointerPosition() || null, []);
    const toStagePoint = useCallback((stage: Konva.Stage, client: { x: number; y: number }) => {
        const t = stage.getAbsoluteTransform().copy().invert();
        return t.point(client);
    }, []);

    // 임시 도형 관리
    const createTempShape = useCallback((type: ToolType, layer: Konva.Layer, x: number, y: number) => {
        if (tempShapeRef.current) {
            tempShapeRef.current.destroy();
            tempShapeRef.current = null;
        }
        tempTypeRef.current = type;

        let temp: Konva.Shape;
        if (type === 'circle') {
            temp = new Konva.Circle({
                id: '__temp-shape__',
                x,
                y,
                radius: 0,
                fill: 'rgba(59,130,246,0.2)',
                stroke: '#3b82f6',
                strokeWidth: 2,
                dash: [5, 5],
                listening: false,
            });
        } else if (type === 'rectangle') {
            temp = new Konva.Rect({
                id: '__temp-shape__',
                x,
                y,
                width: 0,
                height: 0,
                fill: 'rgba(59,130,246,0.2)',
                stroke: '#3b82f6',
                strokeWidth: 2,
                dash: [5, 5],
                listening: false,
            });
        } else if (type === 'line') {
            temp = new Konva.Line({
                id: '__temp-shape__',
                points: [x, y, x, y], // 시작점과 끝점을 동일하게
                stroke: '#3b82f6',
                strokeWidth: 3,
                dash: [8, 4],
                listening: false,
                lineCap: 'round',
                lineJoin: 'round',
            });
        } else {
            return;
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

            if (toolState.coatingType === "fill") {
                const { lineSpacing, coatingWidth, fillPattern } = toolState;

                if (temp instanceof Konva.Rect) {
                    const { width: snappedWidth, height: snappedHeight } = snapShapeSize(
                        { width: dx, height: dy },
                        toolState
                    );
                    const x = Math.min(startPoint.x, startPoint.x + snappedWidth);
                    const y = Math.min(startPoint.y, startPoint.y + snappedHeight);
                    const width = Math.abs(snappedWidth);
                    const height = Math.abs(snappedHeight);
                    temp.position({ x, y });
                    temp.size({ width, height });

                    const patternImage = createCoatingPatternCanvas('rectangle', width, height, lineSpacing, coatingWidth, fillPattern);
                    temp.fillPatternImage(patternImage);
                    temp.fillPatternRepeat('no-repeat');
                    temp.fill(undefined);

                } else if (temp instanceof Konva.Circle) {
                    const rawRadius = Math.sqrt(dx * dx + dy * dy);
                    const snappedRadius = snapCircleRadius(rawRadius, toolState);
                    temp.position({ x: startPoint.x, y: startPoint.y });
                    temp.radius(snappedRadius);

                    if (snappedRadius > 0) {
                        const size = snappedRadius * 2;
                        const patternImage = createCoatingPatternCanvas('circle', size, size, lineSpacing, coatingWidth, fillPattern);
                        temp.fillPatternImage(patternImage);
                        temp.fillPatternRepeat('no-repeat');
                        temp.fillPatternOffset({ x: snappedRadius, y: snappedRadius });
                        temp.fill(undefined);
                    }
                } else if (temp instanceof Konva.Line) {
                    temp.points([startPoint.x, startPoint.y, endPoint.x, endPoint.y]);
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
                } else if (temp instanceof Konva.Line) {
                    temp.points([startPoint.x, startPoint.y, endPoint.x, endPoint.y]);
                }
            }
            temp.getLayer()?.batchDraw();
        },
        [toolState, snapShapeSize, snapCircleRadius]
    );

    const destroyTempShape = useCallback(() => {
        if (tempShapeRef.current) {
            tempShapeRef.current.destroy();
            tempShapeRef.current = null;
        }
        tempTypeRef.current = null;
    }, []);

    const startDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!(DRAWING_TOOLS.includes(toolState.tool))) return false;

        const stage = e.target.getStage();
        if (!stage) return false;

        const isValidTarget = e.target === stage || !e.target.listening() || e.target.id() === '';
        if (!isValidTarget) return false;

        const layers = stage.getLayers();
        const drawingLayer = layers.find(layer => !layer.name() || layer.name() === '') || layers[0];
        if (!drawingLayer) return false;

        const client = getPointerClient(stage);
        if (!client) return false;

        isDrawingRef.current = true;
        drawStartClientRef.current = client;

        const startStagePoint = toStagePoint(stage, client);
        const snappedStartPoint = snapPointToGrid(startStagePoint);
        drawStartStageRef.current = snappedStartPoint;

        createTempShape(toolState.tool, drawingLayer, snappedStartPoint.x, snappedStartPoint.y);
        return true;
    }, [toolState.tool, getPointerClient, toStagePoint, snapPointToGrid, createTempShape]);

    const updateDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawingRef.current || !drawStartStageRef.current) return false;
        if (!DRAWING_TOOLS.includes(toolState.tool)) return false;

        const stage = e.target.getStage();
        if (!stage) return false;

        const cur = getPointerClient(stage);
        if (!cur) return false;

        const startPoint = drawStartStageRef.current;
        const currentPoint = snapPointToGrid(toStagePoint(stage, cur));

        updateTempShape(startPoint, currentPoint);
        return true;
    }, [toolState.tool, getPointerClient, toStagePoint, snapPointToGrid, updateTempShape]);

    const finishDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawingRef.current || !drawStartClientRef.current || !drawStartStageRef.current) return false;
        if (!DRAWING_TOOLS.includes(toolState.tool)) return false;

        const stage = e.target.getStage();
        if (!stage) return false;

        const startClient = drawStartClientRef.current;
        const startStagePoint = drawStartStageRef.current;
        const endClient = getPointerClient(stage);

        isDrawingRef.current = false;
        drawStartClientRef.current = null;
        drawStartStageRef.current = null;
        destroyTempShape();

        if (!endClient) {
            dispatch(setTool('select'));
            return true;
        }

        const dist = Math.hypot(endClient.x - startClient.x, endClient.y - startClient.y);
        if (dist > 3) {
            const s = startStagePoint;
            const ept = snapPointToGrid(toStagePoint(stage, endClient));

            let newShape: CustomShapeConfig;

            const commonShapeProps = {
                id: crypto.randomUUID(),
                parentId: null,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                listening: false,
                visible: true,
                isLocked: false,
                coatingType: toolState.coatingType,
                coatingSpeed: toolState.coatingSpeed,
                coatingHeight: toolState.coatingHeight,
                coatingWidth: toolState.coatingWidth,
                ...(toolState.coatingType === 'fill' && { fillPattern: toolState.fillPattern, lineSpacing: toolState.lineSpacing }),
                ...(toolState.coatingType === 'outline' && { outlineType: toolState.outlineType, outlinePasses: toolState.outlinePasses, outlineInterval: toolState.outlineInterval }),
                ...(toolState.coatingType === 'masking' && { maskingClearance: toolState.maskingClearance, travelAvoidanceStrategy: toolState.travelAvoidanceStrategy }),
            };

            if (toolState.tool === 'rectangle') {
                const rawWidth = ept.x - s.x;
                const rawHeight = ept.y - s.y;
                const { width: snappedWidth, height: snappedHeight } = snapShapeSize({ width: rawWidth, height: rawHeight }, toolState);
                const x = Math.min(s.x, s.x + snappedWidth);
                const y = Math.min(s.y, s.y + snappedHeight);
                const width = Math.abs(snappedWidth);
                const height = Math.abs(snappedHeight);
                const fill = toolState.coatingType === 'fill' ? undefined : 'rgba(59,130,246,0.5)';
                newShape = { ...commonShapeProps, type: 'rectangle', x, y, width, height, fill };
            } else if (toolState.tool === 'circle') {
                const dx = ept.x - s.x;
                const dy = ept.y - s.y;
                const rawRadius = Math.sqrt(dx * dx + dy * dy);
                const radius = snapCircleRadius(rawRadius, toolState);
                const fill = toolState.coatingType === 'fill' ? undefined : 'rgba(59,130,246,0.5)';
                newShape = { ...commonShapeProps, type: 'circle', x: s.x, y: s.y, radius, fill };
            } else if (toolState.tool === 'line') {
                newShape = {
                    ...commonShapeProps,
                    type: 'line',
                    name: '직선',
                    x: s.x,
                    y: s.y,
                    fill: undefined,
                    stroke: '#000000',
                    strokeWidth: 2,
                    points: [0, 0, ept.x - s.x, ept.y - s.y],
                    coatingType: 'outline'
                };
            } else {
                dispatch(setTool('select'));
                return true;
            }

            if (newShape) {
                dispatch(addShape(newShape));
            }
        }

        dispatch(setTool('select'));
        return true;
    }, [toolState, getPointerClient, toStagePoint, snapPointToGrid, destroyTempShape, dispatch, snapShapeSize, snapCircleRadius]);

    const cancelDrawing = useCallback(() => {
        isDrawingRef.current = false;
        drawStartClientRef.current = null;
        drawStartStageRef.current = null;
        destroyTempShape();
    }, [destroyTempShape]);

    return {
        startDrawing,
        updateDrawing,
        finishDrawing,
        cancelDrawing,
        isDrawing: isDrawingRef.current,
    };
}
