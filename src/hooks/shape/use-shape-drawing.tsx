import { useCallback, useRef } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { addShape } from '@/store/slices/shape-slice';
import { setTool } from '@/store/slices/tool-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { useSettings } from '@/contexts/settings-context';
import { DRAWING_TOOLS, DrawingTool, SHAPE_TOOLS, ToolType } from "@/types/tool-type";

export function useShapeDrawing() {
    const dispatch = useAppDispatch();
    const toolState = useAppSelector((state) => state.tool);
    const { isSnappingEnabled, pixelsPerMm, gcodeSettings } = useSettings();

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
        (v: number) => (isSnappingEnabled ? Math.round(v / pixelsPerMm) * pixelsPerMm : v),
        [isSnappingEnabled, pixelsPerMm]
    );
    const snapPoint = useCallback(
        (p: { x: number; y: number }) => ({ x: snap(p.x), y: snap(p.y) }),
        [snap]
    );

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
            const lineSpacing = gcodeSettings.lineSpacing;

            if (toolState.coatingType === "fill") {
                let snappedWidth = dx;
                let snappedHeight = dy;

                if (toolState.fillPattern === 'horizontal') {
                    snappedHeight = Math.round(dy / lineSpacing) * lineSpacing;
                } else if (toolState.fillPattern === 'vertical') {
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
                } else if (temp instanceof Konva.Line) {
                    // 라인은 채우기 패턴이 적용되지 않으므로 일반 처리
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
                    // 라인: 절대 좌표로 점들 설정
                    temp.points([startPoint.x, startPoint.y, endPoint.x, endPoint.y]);
                }
            }
            temp.getLayer()?.batchDraw();
        },
        [toolState, gcodeSettings.lineSpacing]
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
            toolState: toolState.tool,
            targetName: e.target.name(),
            targetConstructor: e.target.constructor.name,
            isStage: e.target === e.target.getStage()
        });

        // 그리기 도구가 아닌 경우 early return
        if (!(DRAWING_TOOLS.includes(toolState.tool))) {
            console.log('❌ Not a drawing tool:', toolState.tool);
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

        console.log('✅ Starting drawing', { tool: toolState.tool, client });
        isDrawingRef.current = true;
        drawStartClientRef.current = client;
        const sp = snapPoint(toStagePoint(stage, client));
        createTempShape(toolState.tool, drawingLayer, sp.x, sp.y);
        return true;
    }, [toolState.tool, getPointerClient, snapPoint, toStagePoint, createTempShape]);

    const updateDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawingRef.current || !drawStartClientRef.current) return false;
        if (!DRAWING_TOOLS.includes(toolState.tool)) return false; // line 포함으로 수정

        const stage = e.target.getStage();
        if (!stage) return false;

        const cur = getPointerClient(stage);
        if (!cur) return false;

        const s = snapPoint(toStagePoint(stage, drawStartClientRef.current));
        const c = snapPoint(toStagePoint(stage, cur));
        updateTempShape(s, c);
        return true;
    }, [toolState.tool, getPointerClient, toStagePoint, snapPoint, updateTempShape]);

    const finishDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawingRef.current || !drawStartClientRef.current) return false;
        if (!DRAWING_TOOLS.includes(toolState.tool)) return false; // line 포함으로 수정

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

            // 공통 코팅 속성 구성
            const commonShapeProps = {
                id: crypto.randomUUID(),
                parentId: null,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                listening: false,
                visible: true,
                isLocked: false,

                // toolState 기반 코팅 설정 적용
                coatingType: toolState.coatingType,
                coatingSpeed: toolState.coatingSpeed,
                coatingHeight: toolState.coatingHeight,
                coatingWidth: toolState.coatingWidth,

                // 코팅 타입별 세부 설정
                ...(toolState.coatingType === 'fill' && {
                    fillPattern: toolState.fillPattern,
                    lineSpacing: toolState.lineSpacing,
                }),

                ...(toolState.coatingType === 'outline' && {
                    outlineType: toolState.outlineType,
                    outlinePasses: toolState.outlinePasses,
                    outlineInterval: toolState.outlineInterval,
                }),

                ...(toolState.coatingType === 'masking' && {
                    maskingClearance: toolState.maskingClearance,
                    travelAvoidanceStrategy: toolState.travelAvoidanceStrategy,
                }),
            };

            if (toolState.tool === 'rectangle') {
                const x = Math.min(s.x, ept.x);
                const y = Math.min(s.y, ept.y);
                const width = Math.abs(ept.x - s.x);
                const height = Math.abs(ept.y - s.y);

                newShape = {
                    ...commonShapeProps,
                    type: 'rectangle',
                    name: '사각형',
                    x,
                    y,
                    width,
                    height,
                    fill: 'rgba(59,130,246,0.5)',
                };
            } else if (toolState.tool === 'circle') {
                const dx = ept.x - s.x;
                const dy = ept.y - s.y;
                const radius = Math.sqrt(dx * dx + dy * dy);

                newShape = {
                    ...commonShapeProps,
                    type: 'circle',
                    name: '원형',
                    x: s.x,
                    y: s.y,
                    radius: radius,
                    fill: 'rgba(59,130,246,0.5)',
                };
            } else if (toolState.tool === 'line') {
                newShape = {
                    ...commonShapeProps,
                    type: 'line',
                    name: '직선',
                    x: s.x, // 시작점을 기준으로 위치
                    y: s.y,
                    fill: undefined, // 라인은 fill 없음
                    stroke: '#000000',
                    strokeWidth: 2,
                    // 상대 좌표로 점들 저장
                    points: [0, 0, ept.x - s.x, ept.y - s.y],
                    startPoint: { x: 0, y: 0 },
                    endPoint: { x: ept.x - s.x, y: ept.y - s.y },
                    // 라인은 기본적으로 outline 타입
                    coatingType: 'outline'
                };
            } else {
                dispatch(setTool('select'));
                return true;
            }

            if (newShape!) {
                dispatch(addShape(newShape));
            }
        }

        dispatch(setTool('select'));
        return true;
    }, [toolState, getPointerClient, toStagePoint, snapPoint, destroyTempShape, dispatch]);

    const cancelDrawing = useCallback(() => {
        isDrawingRef.current = false;
        drawStartClientRef.current = null;
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