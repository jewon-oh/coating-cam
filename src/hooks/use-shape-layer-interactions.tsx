import React, {useCallback, useEffect, useMemo, useRef} from 'react';
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
import {StageState} from "@/contexts/canvas-context";

type Tool = 'select' | 'circle' | 'rectangle';

export function useShapeLayerInteractions(
    // stageRef: React.RefObject<Konva.Stage | null>,
    setStage: (updater: React.SetStateAction<StageState>)=>void,
    selectionRectRef: React.RefObject<Konva.Rect | null>,
    isPanning: boolean,
    setIsPanning: React.Dispatch<React.SetStateAction<boolean>>
) {
    const dispatch = useAppDispatch();
    const {shapes, selectedShapeIds} = useAppSelector((state) => state.shapes);
    const tool = useAppSelector((state) => state.tool.tool) as Tool;
    const {isSnappingEnabled, gridSize,gcodeSettings} = useSettings();

    // 최신 스냅샷 저장용
    const shapesRef = useRef(shapes);
    useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);


    // 패닝 종료: 마우스 업/리브 시 draggable 해제
    const stopPan = useCallback((s: Konva.Stage) => {
        if (!s) return;

        setIsPanning(false);
        s.draggable(false);
    }, [setIsPanning]);

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
        (startClient: { x: number; y: number }, endClient: { x: number; y: number },stage: Konva.Stage) => {
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
        [dispatch,  toStagePoint]
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
            if (remain.length) {
                dispatch(selectGroup(remain))
            } else {
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

    // 클립보드: 도형 배열 또는 그룹 번들
    type ClipboardGroupsPayload = { kind: 'groups'; groups: Array<{ group: AnyNodeConfig; members: AnyNodeConfig[] }> };
    type ClipboardShapesPayload = { kind: 'shapes'; items: AnyNodeConfig[] };
    type ClipboardPayload = ClipboardGroupsPayload | ClipboardShapesPayload | null;
    const clipboardRef = useRef<ClipboardPayload>(null);

    const handleCopy = useCallback(() => {
        const current = shapesRef.current || [];
        const selectedSet = new Set(selectedShapeIds);
        if (!selectedSet.size) {
            clipboardRef.current = null;
            return;
        }

        // Build children map to compute group memberships (descendants)
        const childrenByParent = new Map<string | null, AnyNodeConfig[]>();
        current.forEach(s => {
            const p = s.parentId || null;
            const arr = childrenByParent.get(p) || [];
            arr.push(s);
            childrenByParent.set(p, arr);
        });
        const collectDescendants = (parentId: string): AnyNodeConfig[] => {
            const out: AnyNodeConfig[] = [];
            const stack: string[] = [parentId];
            while (stack.length) {
                const pid = stack.pop()!;
                const kids = childrenByParent.get(pid) || [];
                for (const child of kids) {
                    if (!child.id) continue;
                    if (child.type === 'group') stack.push(child.id);
                    else out.push(child);
                }
            }
            return out;
        };

        // Try to detect if the selection matches one or more whole groups
        const groups = current.filter(s => s.type === 'group');
        const remaining = new Set(selectedSet);
        const matchedGroups: Array<{ group: AnyNodeConfig; members: AnyNodeConfig[] }> = [];
        for (const g of groups) {
            const members = collectDescendants(g.id!);
            if (members.length === 0) continue;
            const memberIds = new Set(members.map(m => m.id!));
            // If all members are selected and there is no extra selected item for this group
            const isSubset = Array.from(memberIds).every(id => selectedSet.has(id));
            if (isSubset) {
                // Only accept if we can subtract them from remaining (to allow multi-group selection)
                let canTake = true;
                for (const id of memberIds) if (!remaining.has(id)) {
                    canTake = false;
                    break;
                }
                if (canTake) {
                    for (const id of memberIds) remaining.delete(id);
                    matchedGroups.push({group: g, members});
                }
            }
        }

        if (matchedGroups.length > 0 && remaining.size === 0) {
            clipboardRef.current = {kind: 'groups', groups: matchedGroups};
            return;
        }

        // Fallback: copy raw selected shapes (non-groups only)
        const items = current.filter((s) => selectedSet.has(s.id!) && s.type !== 'group');
        clipboardRef.current = {kind: 'shapes', items};
    }, [selectedShapeIds]);

    const handlePaste = useCallback(() => {
        const payload = clipboardRef.current;
        if (!payload) return;

        const base = shapesRef.current || [];

        if (payload.kind === 'groups') {
            const additions: AnyNodeConfig[] = [];
            const newSelectIds: string[] = [];
            for (const {group, members} of payload.groups as Array<{
                group: AnyNodeConfig;
                members: AnyNodeConfig[]
            }>) {
                const newGroupId = crypto.randomUUID();
                const newGroup: AnyNodeConfig = {
                    id: newGroupId,
                    parentId: null,
                    type: 'group',
                    name: `${group.name || 'Group'} Copy`,
                    listening: false,
                    visible: true,
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
                } as AnyNodeConfig;
                additions.push(newGroup);
                for (const m of members) {
                    const newId = crypto.randomUUID();
                    const dup: AnyNodeConfig = {
                        ...m,
                        id: newId,
                        parentId: newGroupId,
                        name: `${m.name || m.type} Copy`,
                        x: (m.x || 0) + 20,
                        y: (m.y || 0) + 20,
                    } as AnyNodeConfig;
                    additions.push(dup);
                    newSelectIds.push(newId);
                }
            }
            const next = [...base, ...additions] as AnyNodeConfig[];
            dispatch(setAllShapes(next));
            dispatch(setPresent(next));
            dispatch(selectGroup(newSelectIds));
            return;
        }

        if (payload.kind === 'shapes') {
            const pasted = (payload.items as AnyNodeConfig[]).map((s) => ({
                ...s,
                id: crypto.randomUUID(),
                name: `${s.name} Copy`,
                x: (s.x || 0) + 20,
                y: (s.y || 0) + 20,
            }));
            const next = [...base, ...pasted] as AnyNodeConfig[];
            dispatch(setAllShapes(next));
            dispatch(setPresent(next));
            dispatch(selectGroup(pasted.map((p) => p.id!)));
            return;
        }
    }, [dispatch]);

    const handleCut = useCallback(() => {
        if (!selectedShapeIds.length) return;
        handleCopy();
        const remaining = shapesRef.current.filter((s) => !selectedShapeIds.includes(s.id!));
        dispatch(removeShapes(selectedShapeIds));
        dispatch(setPresent(remaining));
    }, [dispatch, selectedShapeIds, handleCopy]);

    const handleContextMenu = useCallback((e: KonvaEventObject<PointerEvent>) => {
        // Prevent the browser default context menu and allow our UI ContextMenu to appear
        // e.evt.preventDefault();

        const stage = e.target.getStage();
        if (!stage) return;

        // Only handle selection behaviors for the select tool
        if (tool !== 'select') return;

        const target = e.target as Konva.Node | null;
        if (!target) return;

        // If right-clicked on empty space (the Stage), clear selection
        if (target === stage) {
            // Clear any drag-select preview if happened
            dispatch(unselectAllShapes());
            return;
        }

        // If right-clicked a shape and it's not in current selection, select it
        const id = target.id?.();
        if (!id) return;
        const exists = shapesRef.current.some((s) => s.id === id);
        if (!exists) return;

        const alreadySelected = selectedShapeIds.includes(id);
        if (!alreadySelected) {
            dispatch(selectShape(id));
        }
    }, [dispatch, selectedShapeIds, tool]);

    // 핸들러: Mouse
    const handleMouseDown = useCallback(
        (e: KonvaEventObject<MouseEvent>, layerRef?: React.RefObject<Konva.Layer | null>) => {
            const stage = e.target.getStage();
            if (!stage) return;

            const layer = layerRef?.current;
            if (!layer) return;

            const client = getPointerClient(stage);
            if (!client) return;

            // Middle click만 패닝
            if (e.evt.buttons === 4) {
                if (!stage) return;

                setIsPanning(true);
                stage.draggable(true);
                // mousedown 시점에 draggable을 켰으므로 드래그를 강제로 시작해 자연스러운 패닝
                stage.startDrag();
                return;
            }

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

            // 그리기 시작 (드래그가 아니라 마우스다운에서 시작)
            if ((tool === 'circle' || tool === 'rectangle') && e.target === stage) {
                isDrawingRef.current = true;
                drawStartClientRef.current = client;
                const sp = snapPoint(toStagePoint(stage, client));
                createTempShape(tool, layer, sp.x, sp.y);
                return;
            }
        },
        [ getPointerClient, setIsPanning, tool, toStagePoint, updateSelectionRect, dispatch, snapPoint, createTempShape]
    );

    // 마우스 이동으로 선택/그리기 미리보기 업데이트
    const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;

        // 패닝 중에는 무시 (드래그 이벤트에서 처리)
        if (isPanning) return;

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
    }, [ isPanning, tool, toStagePoint, updateSelectionRect, getPointerClient, updateTempShape]);

    const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage) {
            return;
        }

        stopPan(stage);

        // 박스 선택 종료
        if (isDragSelectingRef.current && dragSelectStartClientRef.current && tool === 'select') {
            const endClient = getPointerClient(stage);
            const startClient = dragSelectStartClientRef.current;

            isDragSelectingRef.current = false;
            dragSelectStartClientRef.current = null;

            if (endClient) {
                const dist = Math.hypot(endClient.x - startClient.x, endClient.y - startClient.y);
                if (dist > 3) performDragSelection(startClient, endClient,stage);
            }
            updateSelectionRect(0, 0, 0, 0, false);
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
            } else {
                const dist = Math.hypot(endClient.x - startClient.x, endClient.y - startClient.y);
                if (dist > 3) {
                    const s = snapPoint(toStagePoint(stage, startClient));
                    const ept = snapPoint(toStagePoint(stage, endClient));

                    if (tool === 'rectangle') {
                        const x = Math.min(s.x, ept.x);
                        const y = Math.min(s.y, ept.y);
                        const width = Math.abs(ept.x - s.x);
                        const height = Math.abs(ept.y - s.y);

                        const rect: AnyNodeConfig = {
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
                        };
                        const next = [...shapesRef.current, rect] as AnyNodeConfig[];
                        dispatch(addShape(rect));
                        dispatch(setPresent(next));
                    } else if (tool === 'circle') {
                        const cx = (s.x + ept.x) / 2;
                        const cy = (s.y + ept.y) / 2;
                        const r = Math.max(Math.abs(ept.x - s.x), Math.abs(ept.y - s.y)) / 2;

                        const circle: AnyNodeConfig = {
                            id: crypto.randomUUID(),
                            parentId: null,
                            type: 'circle',
                            name: '원형',
                            x: cx,
                            y: cy,
                            radius: r,
                            fill: 'rgba(59,130,246,0.5)',
                            rotation: 0,
                            scaleX: 1,
                            scaleY: 1,
                            listening: false,
                            visible: true,
                            isLocked: false,
                        };
                        const next = [...shapesRef.current, circle] as AnyNodeConfig[];
                        dispatch(addShape(circle));
                        dispatch(setPresent(next));
                    }
                }
                dispatch(setTool('select'));
            }
        }

        stopPan(stage);
    }, [tool, stopPan, getPointerClient, updateSelectionRect, performDragSelection, destroyTempShape, dispatch, snapPoint, toStagePoint]);

    const handleMouseLeave = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if(!stage) return;

        stopPan(stage);
        // 선택/그리기 상태 초기화
        isDragSelectingRef.current = false;
        dragSelectStartClientRef.current = null;
        isDrawingRef.current = false;
        drawStartClientRef.current = null;
        destroyTempShape();
        updateSelectionRect(0, 0, 0, 0, false);
    }, [stopPan, destroyTempShape, updateSelectionRect])

// 드래그 시작 위치 저장용
    const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

    // 드래그 시작 핸들러
    const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {

        const node = e.target;
        dragStartPositionsRef.current.set(node.id(), {
            x: node.x(),
            y: node.y()
        });
    }, []);

    // 드래그 종료 핸들러 - 실제 이동했을 때만 히스토리 기록
    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const shape = shapesRef.current.find(s => s.id === node.id());

        if (!shape) return;

        const startPos = dragStartPositionsRef.current.get(node.id());
        const currentPos = {x: node.x(), y: node.y()};

        // 실제로 이동했는지 확인 (최소 1픽셀 이상)
        const hasMoved = !startPos ||
            Math.abs(currentPos.x - startPos.x) > 0.5 ||
            Math.abs(currentPos.y - startPos.y) > 0.5;

        if (!hasMoved) {
            dragStartPositionsRef.current.delete(node.id());
            return;
        }

        // 위치 업데이트 및 히스토리 기록 로직 (위와 동일)
        const updates: { id: string; props: Partial<AnyNodeConfig> }[] = [];

        if (selectedShapeIds.includes(shape.id!)) {
            selectedShapeIds.forEach(shapeId => {
                const targetShape = shapesRef.current.find(s => s.id === shapeId);
                if (targetShape) {
                    const stage = e.target.getStage();
                    const stageNode = stage?.findOne(`#${shapeId}`);
                    if (stageNode) {
                        updates.push({
                            id: shapeId,
                            props: {
                                x: stageNode.x(),
                                y: stageNode.y(),
                            }
                        });
                    }
                }
            });
        } else {
            updates.push({
                id: shape.id!,
                props: currentPos
            });
        }

        if (updates.length > 0) {
            dispatch(batchUpdateShapes(updates));

            const updatedShapes = shapesRef.current.map(shape => {
                const update = updates.find(u => u.id === shape.id);
                return update ? {...shape, ...update.props} : shape;
            });

            dispatch(setPresent(updatedShapes));
        }

        // 시작 위치 정리
        dragStartPositionsRef.current.delete(node.id());

    }, [dispatch, selectedShapeIds]);


    // Stage 전용 드래그 시작 핸들러 (그리기 용)
    const handleStageDragStart = useCallback((e: KonvaEventObject<MouseEvent>, layerRef?: React.RefObject<Konva.Layer | null>) => {
        const stage = e.target.getStage();
        if (!stage) return;

        const layer = layerRef?.current;
        if (!layer) return;

        const client = getPointerClient(stage);
        if (!client) return;


        // 그리기 시작
        if ((tool === 'circle' || tool === 'rectangle') && e.target === stage) {
            isDrawingRef.current = true;
            drawStartClientRef.current = client;
            const sp = snapPoint(toStagePoint(stage, client));
            createTempShape(tool, layer, sp.x, sp.y);
            return;
        }
    }, [createTempShape, getPointerClient, snapPoint, toStagePoint, tool]);

    // Stage 전용 드래그 이동 핸들러
    const handleStageDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;

        if (e.target !== stage) return;

        // 드래그 이동 중 Stage 위치를 Context 상태에 동기화 (패닝)
        if (isPanning) {
            setStage(prev => ({
                ...prev,
                x: stage.x(),
                y: stage.y(),
            }));
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
    }, [ isPanning, setStage, tool, toStagePoint, updateSelectionRect, getPointerClient, updateTempShape]);

    const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;


        // 드래그 종료 시 최종 위치 동기화 후 패닝 종료
        if (isPanning) {
            setStage(prev => ({
                ...prev,
                x: stage.x(),
                y: stage.y(),
            }));
            stopPan(stage);
        }

        // 박스 선택 종료
        if (isDragSelectingRef.current && dragSelectStartClientRef.current && tool === 'select') {
            const endClient = getPointerClient(stage);
            const startClient = dragSelectStartClientRef.current;

            isDragSelectingRef.current = false;
            dragSelectStartClientRef.current = null;

            if (endClient) {
                const dist = Math.hypot(endClient.x - startClient.x, endClient.y - startClient.y);
                if (dist > 3) performDragSelection(startClient, endClient,stage);
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
                    parentId: null,
                    type: 'rectangle',
                    name: 'Rectangle',
                    x, y, width, height,
                    // fill: 'rgba(59,130,246,0.5)',
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    isLocked: false,
                    visible: true,
                    coatingType: 'masking', // 기본은 마스킹
                    coatingHeight: gcodeSettings.coatingHeight
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
                    parentId: null,
                    type: 'circle',
                    name: 'Circle',
                    x: cx,
                    y: cy,
                    radius: r,
                    // fill: 'rgba(59,130,246,0.5)',
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    isLocked: false,
                    visible: true,
                    coatingType: 'masking', // 기본은 마스킹
                    coatingHeight: gcodeSettings.coatingHeight
                };
                const next = [...shapesRef.current, circle] as AnyNodeConfig[];
                dispatch(addShape(circle));
                dispatch(setPresent(next));
            }

            dispatch(setTool('select'));
        }
    }, [destroyTempShape, dispatch, gcodeSettings.coatingHeight, getPointerClient, isPanning, performDragSelection, setStage, snapPoint, stopPan, toStagePoint, tool, updateSelectionRect])

    // 휠 줌: rAF 스로틀 + 스케일 클램프 (Stage 중심이 아닌 포인터 중심 줌)
    const rafIdRef = useRef<number | null>(null);
    useEffect(() => () => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    }, []);


    const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        e.cancelBubble = true; // Konva의 버블링을 막아 상위 요소 스크롤 방지

        const stage = e.target.getStage();
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // 1. 현재 스케일 값을 부호를 포함하여 가져옵니다. (Math.abs 제거)
        const oldScaleX = stage.scaleX();
        const oldScaleY = stage.scaleY();

        // 확대/축소 비율 계산
        const scaleBy = 1.05;
        const direction = e.evt.deltaY > 0 ? -1 : 1;

        // 새 스케일의 '크기'를 계산하고 범위를 제한합니다.
        const newScale = direction > 0 ? Math.abs(oldScaleX) * scaleBy : Math.abs(oldScaleX) / scaleBy;
        const clampedScale = Math.max(0.1, Math.min(10, newScale));

        // 2. X축 반전 상태를 유지하면서 새 스케일 값을 결정합니다.
        const isXInverted = oldScaleX < 0;
        const newScaleX = isXInverted ? -clampedScale : clampedScale;
        const newScaleY = clampedScale; // Y축은 항상 양수로 가정

        // 3. 안정적인 단일 공식을 사용하여 새 위치를 계산합니다.
        // (pointer.x - stage.x()) / oldScaleX  => 마우스 포인터의 캔버스 내 상대 좌표
        const newX = pointer.x - ((pointer.x - stage.x()) / oldScaleX) * newScaleX;
        const newY = pointer.y - ((pointer.y - stage.y()) / oldScaleY) * newScaleY;

        // rAF를 사용한 상태 업데이트 (기존 로직 유지)
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
            setStage(prev => ({
                ...prev,
                scaleX: newScaleX,
                scaleY: newScaleY,
                x: newX,
                y: newY,
            }));
            rafIdRef.current = null;
        });
    }, [setStage]);
    const handleGroup = useCallback(() => {
        // Need at least 2 selected to form a group
        if (selectedShapeIds.length < 2) return;

        const current = shapesRef.current || [];
        // Determine existing group(s) among the selected shapes
        const selectedShapes = current.filter(s => selectedShapeIds.includes(s.id!));
        const existingGroupIds = new Set(
            selectedShapes
                .map(s => s.parentId)
                .filter((pid): pid is string => !!pid)
                .filter(pid => current.some(x => x.id === pid && x.type === 'group'))
        );

        let next: AnyNodeConfig[];
        const memberIds = selectedShapes.filter(s => s.type !== 'group').map(s => s.id!)

        if (existingGroupIds.size === 1) {
            // Merge: add all selected (non-group) shapes into the existing single group
            const targetGroupId = Array.from(existingGroupIds)[0];
            next = current.map(s => (memberIds.includes(s.id!) ? {
                ...s,
                parentId: targetGroupId
            } : s)) as AnyNodeConfig[];
            dispatch(setAllShapes(next));
            dispatch(setPresent(next));
            dispatch(selectGroup(memberIds));
            return;
        }

        // Fallback: create a new logical group and move all selected into it
        const groupId = crypto.randomUUID();
        const groupNode: AnyNodeConfig = {
            id: groupId,
            parentId: null,
            type: 'group' as const,
            name: '그룹',
            listening: false,
            visible: true,
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
        } as unknown as AnyNodeConfig;

        next = [...current.map(s => (memberIds.includes(s.id!) ? {
            ...s,
            parentId: groupId
        } : s)), groupNode] as AnyNodeConfig[];
        dispatch(setAllShapes(next));
        dispatch(setPresent(next));
        // Select member shapes rather than the logical group node (Transformer usability)
        dispatch(selectGroup(memberIds));
    }, [dispatch, selectedShapeIds]);

    return useMemo(() => ({
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
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
        handleStageDragStart,
        handleStageDragMove,
        handleStageDragEnd,
        handleWheel,
        handleGroup,
    }), [handleContextMenu, handleCopy, handleCut, handleDelete, handleDragEnd, handleDragMove, handleDragStart, handleGroup, handleMouseDown, handleMouseLeave, handleMouseMove, handleMouseUp, handlePaste, handleSelect, handleSelectAll, handleStageDragEnd, handleStageDragMove, handleStageDragStart, handleWheel]);
}