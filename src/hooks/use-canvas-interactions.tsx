import React, {useCallback, useEffect, useRef} from 'react';
import Konva from 'konva';
import type {KonvaEventObject} from 'konva/lib/Node';
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import {
    addShape,
    removeShapes,
    selectGroup,
    selectShape,
    unselectAllShapes,
    batchUpdateShapes, setAllShapes,
} from '@/store/slices/shapes-slice';
import {setPresent} from '@/store/slices/history-slice';
import {setTool} from '@/store/slices/tool-slice';
import type {AnyNodeConfig} from '@/types/custom-konva-config';
import {useSettings} from '@/contexts/settings-context';

type StageState = { scale: number; x: number; y: number };
type Tool = 'select' | 'circle' | 'rectangle';

export function useCanvasInteractions(
    stageRef: React.RefObject<Konva.Stage | null>,
    setStage: React.Dispatch<React.SetStateAction<StageState>>,
    selectionRectRef: React.RefObject<Konva.Rect | null>,
    isPanningRef: React.RefObject<boolean>,
    onPanChange: (panning: boolean) => void
) {
    const dispatch = useAppDispatch();
    const {shapes, selectedShapeIds} = useAppSelector((state) => state.shapes);
    const tool = useAppSelector((state) => state.tool.tool) as Tool;
    const {isSnappingEnabled, gridSize} = useSettings();

    // 최신 스냅샷 저장용
    const shapesRef = useRef(shapes);
    useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);

    // 내부 상태 refs
    const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
    const rafRef = useRef<number | null>(null);

    // 드래그 선택
    const isDragSelectingRef = useRef(false);
    const dragSelectStartClientRef = useRef<{ x: number; y: number } | null>(null);

    // 도형 그리기
    const isDrawingRef = useRef(false);
    const drawStartClientRef = useRef<{ x: number; y: number } | null>(null);

    // 임시 도형(미리보기)
    const tempShapeRef = useRef<Konva.Shape | null>(null);
    const tempTypeRef = useRef<Tool | null>(null); // 'circle' | 'rectangle'

    // 좌표 유틸
    const toStagePoint = useCallback((stage: Konva.Stage, client: { x: number; y: number }) => {
        const t = stage.getAbsoluteTransform().copy().invert();
        return t.point(client);
    }, []);
    const getPointerClient = useCallback((stage: Konva.Stage) => stage.getPointerPosition() || null, []);

    // 스냅
    const snap = useCallback(
        (v: number) => (isSnappingEnabled ? Math.round(v / gridSize) * gridSize : v),
        [isSnappingEnabled, gridSize]
    );
    const snapPoint = useCallback(
        (p: { x: number; y: number }) => ({x: snap(p.x), y: snap(p.y)}),
        [snap]
    );

    // 커서 업데이트
    const updateCursor = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return;
        const el = stage.container();
        if (isPanningRef.current) el.style.cursor = 'grabbing';
        else if (tool === 'circle' || tool === 'rectangle') el.style.cursor = 'crosshair';
        else el.style.cursor = 'default';
    }, [stageRef, tool, isPanningRef]);
    useEffect(() => updateCursor(), [updateCursor]);

    // 패닝 상태 setter (즉시 ref + 상위 state 반영)
    const setPanning = useCallback(
        (p: boolean) => {
            if (isPanningRef.current === p) return;
            isPanningRef.current = p;   // 즉시성
            onPanChange(p);             // 상위 UI
            updateCursor();
        },
        [isPanningRef, onPanChange, updateCursor]
    );

    // 패닝 rAF 스로틀
    const schedulePanUpdate = useCallback(
        (dx: number, dy: number) => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                setStage((prev) => ({...prev, x: prev.x + dx, y: prev.y + dy}));
                rafRef.current = null;
            });
        },
        [setStage]
    );

    // 선택 사각형 업데이트
    const updateSelectionRect = useCallback(
        (x: number, y: number, w: number, h: number, visible = true) => {
            const rect = selectionRectRef.current;
            if (!rect) return;
            rect.x(x);
            rect.y(y);
            rect.width(w);
            rect.height(h);
            rect.visible(visible);
            rect.getLayer()?.batchDraw();
        },
        [selectionRectRef]
    );

    // 임시 도형 생성/업데이트/파괴
    const createTempShape = useCallback((type: Tool, layer: Konva.Layer, x: number, y: number) => {
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
            temp = new Konva.Circle({...common, radius: 0});
        } else {
            temp = new Konva.Rect({...common, width: 0, height: 0});
        }
        layer.add(temp);
        tempShapeRef.current = temp;
        layer.batchDraw();
    }, []);

    const updateTempShape = useCallback(
        (start: { x: number; y: number }, current: { x: number; y: number }) => {
            const temp = tempShapeRef.current;
            if (!temp || !tempTypeRef.current) return;

            const s = snapPoint(start);
            const c = snapPoint(current);

            if (tempTypeRef.current === 'circle') {
                const cx = (s.x + c.x) / 2;
                const cy = (s.y + c.y) / 2;
                const r = Math.max(Math.abs(c.x - s.x), Math.abs(c.y - s.y)) / 2;
                temp.position({x: cx, y: cy});
                (temp as Konva.Circle).radius(r);
            } else {
                const x = Math.min(s.x, c.x);
                const y = Math.min(s.y, c.y);
                const w = Math.abs(c.x - s.x);
                const h = Math.abs(c.y - s.y);
                (temp as Konva.Rect).position({x, y});
                (temp as Konva.Rect).size({width: w, height: h});
            }
            temp.getLayer()?.batchDraw();
        },
        [snapPoint]
    );

    const destroyTempShape = useCallback(() => {
        if (tempShapeRef.current) {
            tempShapeRef.current.destroy();
            tempShapeRef.current = null;
        }
        tempTypeRef.current = null;
    }, []);

    // 박스 선택 실행
    const performDragSelection = useCallback(
        (startClient: { x: number; y: number }, endClient: { x: number; y: number }) => {
            const stage = stageRef.current;
            if (!stage) return;

            const s = toStagePoint(stage, startClient);
            const e = toStagePoint(stage, endClient);

            const x1 = Math.min(s.x, e.x);
            const y1 = Math.min(s.y, e.y);
            const x2 = Math.max(s.x, e.x);
            const y2 = Math.max(s.y, e.y);

            const ids: string[] = [];
            for (const shape of shapesRef.current) {
                if (shape.visible === false || shape.listening) continue;

                let left = shape.x || 0;
                let top = shape.y || 0;
                let right = (shape.x || 0) + (shape.width || 0);
                let bottom = (shape.y || 0) + (shape.height || 0);

                if (shape.type === 'circle' && shape.radius) {
                    left = (shape.x || 0) - shape.radius;
                    top = (shape.y || 0) - shape.radius;
                    right = (shape.x || 0) + shape.radius;
                    bottom = (shape.y || 0) + shape.radius;
                }

                const overlaps = !(right < x1 || left > x2 || bottom < y1 || top > y2);
                if (overlaps) ids.push(shape.id!);
            }
            if (ids.length) dispatch(selectGroup(ids));
        },
        [dispatch, stageRef, toStagePoint]
    );

    // 드래그 이동 중 스냅
    const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        const node = e.target as Konva.Node & {
            x: () => number;
            y: () => number;
            position: (p: { x: number; y: number }) => void
        };
        const sx = snap(node.x());
        const sy = snap(node.y());
        if (sx !== node.x() || sy !== node.y()) {
            node.position({x: sx, y: sy});
            node.getLayer()?.batchDraw();
        }
    }, [snap]);

    // 단일/멀티 선택
    const handleSelect = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        const id = e.target.id();
        const shape = shapesRef.current.find(s => s.id === id);
        if (tool !== 'select' || shape?.listening) return;

        const meta = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
        const isSelected = selectedShapeIds.includes(id);

        if (!meta && !isSelected) {
            dispatch(selectShape(id));
        } else if (meta && isSelected) {
            const remain = selectedShapeIds.filter(x => x !== id);
            if(remain.length){
                dispatch(selectGroup(remain))
            }else{
                dispatch(unselectAllShapes());
            }
        } else if (meta && !isSelected) {
            dispatch(selectGroup([...selectedShapeIds, id]));
        }
    }, [dispatch, selectedShapeIds, tool]);

    const handleSelectAll = useCallback(() => {
        if (tool !== 'select') return;
        const ids = shapesRef.current
            .filter(s => s.visible !== false && !s.listening)
            .map(s => s.id!)
            .filter(Boolean);
        if (ids.length) dispatch(selectGroup(ids));
    }, [dispatch, tool]);

    // 삭제/복사/붙여넣기/잘라내기/컨텍스트메뉴
    const handleDelete = useCallback(() => {
        if (selectedShapeIds.length === 0) return;
        dispatch(removeShapes(selectedShapeIds));
        const remain = shapesRef.current.filter(s => !selectedShapeIds.includes(s.id!));
        dispatch(setPresent(remain));
        dispatch(unselectAllShapes());
    }, [dispatch, selectedShapeIds]);

    // 클립보드
    const clipboardRef = useRef<AnyNodeConfig[]>([]);

    const handleCopy = useCallback(() => {
        clipboardRef.current = shapesRef.current.filter((s) => selectedShapeIds.includes(s.id!));
    }, [selectedShapeIds]);

    const handlePaste = useCallback(() => {
        if (!clipboardRef.current.length) return;
        const pasted = clipboardRef.current.map((s) => ({
            ...s,
            id: crypto.randomUUID(),
            name: `${s.name} Copy`,
            x: (s.x || 0) + 20,
            y: (s.y || 0) + 20,
        }));
        const next = [...shapesRef.current, ...pasted] as AnyNodeConfig[];
        dispatch(setAllShapes(next));
        dispatch(setPresent(next));
        dispatch(selectGroup(pasted.map((p) => p.id!)));
    }, [dispatch]);

    const handleCut = useCallback(() => {
        if (!selectedShapeIds.length) return;
        handleCopy();
        const remaining = shapesRef.current.filter((s) => !selectedShapeIds.includes(s.id!));
        dispatch(removeShapes(selectedShapeIds));
        dispatch(setPresent(remaining));
    }, [dispatch, selectedShapeIds, handleCopy]);

    const handleContextMenu = useCallback((e: KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault();
    }, []);

    // 핸들러: Mouse
    const handleMouseDown = useCallback(
        (e: KonvaEventObject<MouseEvent>, layerRef?: React.RefObject<Konva.Layer | null>) => {
            const stage = stageRef.current;
            if (!stage) return;

            const layer = layerRef?.current;
            if (!layer) return;

            // Middle 클릭 → 패닝 시작
            if (e.evt.button === 1) {
                lastPointerRef.current = getPointerClient(stage);
                setPanning(true);
                return;
            }

            const client = getPointerClient(stage);
            if (!client) return;

            // Select + 빈공간 → 박스 선택 시작
            if (tool === 'select' && e.target === stage) {
                isDragSelectingRef.current = true;
                dragSelectStartClientRef.current = client;

                if (!e.evt.shiftKey && !e.evt.ctrlKey && !e.evt.metaKey) {
                    dispatch(unselectAllShapes());
                }

                const sp = toStagePoint(stage, client);
                updateSelectionRect(sp.x, sp.y, 0, 0, true);
                return;
            }

            // 그리기 시작
            if ((tool === 'circle' || tool === 'rectangle') && e.target === stage) {
                isDrawingRef.current = true;
                drawStartClientRef.current = client;
                const sp = snapPoint(toStagePoint(stage, client));
                createTempShape(tool, layer, sp.x, sp.y);
                return;
            }
        },
        [stageRef, tool, getPointerClient, setPanning, dispatch, toStagePoint, updateSelectionRect, snapPoint, createTempShape]
    );

    const handleMouseMove = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return;

        // 패닝
        if (isPanningRef.current) {
            const cur = getPointerClient(stage);
            const last = lastPointerRef.current;
            if (!cur || !last) return;
            schedulePanUpdate(cur.x - last.x, cur.y - last.y);
            lastPointerRef.current = cur;
            return;
        }

        // 박스 선택 중
        if (isDragSelectingRef.current && dragSelectStartClientRef.current && tool === 'select') {
            const cur = getPointerClient(stage);
            if (!cur) return;

            const s = toStagePoint(stage, dragSelectStartClientRef.current);
            const c = toStagePoint(stage, cur);

            const x = Math.min(s.x, c.x);
            const y = Math.min(s.y, c.y);
            const w = Math.abs(c.x - s.x);
            const h = Math.abs(c.y - s.y);

            updateSelectionRect(x, y, w, h, true);
            return;
        }

        // 그리기 중
        if (isDrawingRef.current && drawStartClientRef.current && (tool === 'circle' || tool === 'rectangle')) {
            const cur = getPointerClient(stage);
            if (!cur) return;
            const s = toStagePoint(stage, drawStartClientRef.current);
            const c = toStagePoint(stage, cur);
            updateTempShape(s, c);
            return;
        }
    }, [stageRef, tool, isPanningRef, getPointerClient, toStagePoint, updateSelectionRect, schedulePanUpdate, updateTempShape]);

    const handleMouseUp = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return;

        // 패닝 종료
        if (isPanningRef.current) {
            lastPointerRef.current = null;
            setPanning(false);
            return;
        }

        // 박스 선택 종료
        if (isDragSelectingRef.current && dragSelectStartClientRef.current && tool === 'select') {
            const endClient = getPointerClient(stage);
            const startClient = dragSelectStartClientRef.current;

            isDragSelectingRef.current = false;
            dragSelectStartClientRef.current = null;

            if (endClient) {
                const dist = Math.hypot(endClient.x - startClient.x, endClient.y - startClient.y);
                if (dist > 3) performDragSelection(startClient, endClient);
            }
            updateSelectionRect(0, 0, 0, 0, false);
            return;
        }

        // 그리기 종료 → 실제 도형 추가
        if (isDrawingRef.current && drawStartClientRef.current && (tool === 'circle' || tool === 'rectangle')) {
            const endClient = getPointerClient(stage);
            const startClient = drawStartClientRef.current;

            isDrawingRef.current = false;
            drawStartClientRef.current = null;
            destroyTempShape();

            if (!endClient) {
                dispatch(setTool('select'));
                return;
            }
            const dist = Math.hypot(endClient.x - startClient.x, endClient.y - startClient.y);
            if (dist <= 3) {
                dispatch(setTool('select'));
                return;
            }

            const s = snapPoint(toStagePoint(stage, startClient));
            const e = snapPoint(toStagePoint(stage, endClient));

            if (tool === 'rectangle') {
                const x = Math.min(s.x, e.x);
                const y = Math.min(s.y, e.y);
                const width = Math.abs(e.x - s.x);
                const height = Math.abs(e.y - s.y);

                const rect: AnyNodeConfig = {
                    id: crypto.randomUUID(),
                    parentId:null,
                    type: 'rectangle',
                    name: 'Rectangle',
                    x, y, width, height,
                    fill: 'rgba(59,130,246,0.5)',
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    listening: false,
                    visible: true,
                };
                const next = [...shapesRef.current, rect] as AnyNodeConfig[];
                dispatch(addShape(rect));
                dispatch(setPresent(next));
            } else if (tool === 'circle') {
                const cx = (s.x + e.x) / 2;
                const cy = (s.y + e.y) / 2;
                const r = Math.max(Math.abs(e.x - s.x), Math.abs(e.y - s.y)) / 2;

                const circle: AnyNodeConfig = {
                    id: crypto.randomUUID(),
                    parentId:null,
                    type: 'circle',
                    name: 'Circle',
                    x: cx,
                    y: cy,
                    radius: r,
                    fill: 'rgba(59,130,246,0.5)',
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    listening: false,
                    visible: true,
                };
                const next = [...shapesRef.current, circle] as AnyNodeConfig[];
                dispatch(addShape(circle));
                dispatch(setPresent(next));
            }

            dispatch(setTool('select'));
        }
    }, [stageRef, tool, isPanningRef, getPointerClient, toStagePoint, snapPoint, destroyTempShape, performDragSelection, updateSelectionRect, dispatch, setPanning]);

    // 드래그 시작/끝 (선택 도형 이동 완료 시 상태 반영)
    const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {

    }, [getPointerClient, isPanningRef, schedulePanUpdate, stageRef, toStagePoint, tool, updateSelectionRect, updateTempShape]);

    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const shapeId = node.id();
        const found = shapesRef.current.find(s => s.id === shapeId);
        if (!found) return;

        const finalX = node.x();
        const finalY = node.y();
        const next = shapesRef.current.map(s => (s.id === shapeId ? {...s, x: finalX, y: finalY} : s));
        dispatch(batchUpdateShapes([{id: shapeId, props: {x: finalX, y: finalY}}]));
        dispatch(setPresent(next));
    }, [dispatch]);

    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleSelect,
        handleSelectAll,
        handleDelete,
        handleCopy,
        handlePaste,
        handleCut,
        handleContextMenu,
    };
}