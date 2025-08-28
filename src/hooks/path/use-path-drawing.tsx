import { useCallback, useRef, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { addPathGroup, addSegment, setSelectedPath, updateSegment } from '@/store/slices/path-slice';
import type { PathGroup, PathSegment } from '@/types/path';

function getPointerLocal(e: KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pointer);
}

export function usePathDrawing() {
    const dispatch = useAppDispatch();
    const { pathGroups, selectedPathId } = useAppSelector((s) => s.paths);

    const [isDrawing, setIsDrawing] = useState(false);
    const activeGroupIdRef = useRef<string | null>(null);
    const activeSegmentIdRef = useRef<string | null>(null);

    const ensureGroup = useCallback(() => {
        // 이미 선택된 그룹이 있으면 그대로 사용
        const existing = activeGroupIdRef.current || selectedPathId;
        if (existing) {
            activeGroupIdRef.current = existing;
            return existing;
        }

        // 새 PathGroup 생성
        const id = (globalThis.crypto?.randomUUID?.() ?? `path_${Date.now()}`);
        const name = `Path #${pathGroups.length + 1}`;
        const newGroup: PathGroup = {
            id,
            name,
            color: '#1976d2',
            visible: true,
            tool: 'pen',
            speed: 1000,
            power: 100,
            passes: 1,
            segments: [],
        } as PathGroup;

        dispatch(addPathGroup(newGroup));
        dispatch(setSelectedPath(id));
        activeGroupIdRef.current = id;
        return id;
    }, [dispatch, pathGroups.length, selectedPathId]);

    const startDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage || e.target !== stage) return false;

        const p = getPointerLocal(e);
        if (!p) return false;

        const groupId = ensureGroup();

        // 첫 세그먼트 생성 (커서에 따라 이동/선형으로 사용 가능)
        const segId = (globalThis.crypto?.randomUUID?.() ?? `seg_${Date.now()}`);
        const seg: PathSegment = {
            id: segId,
            type: 'line',
            x: p.x,
            y: p.y,
        } as PathSegment;

        dispatch(addSegment({ groupId, segment: seg }));
        activeSegmentIdRef.current = segId;
        setIsDrawing(true);
        return true;
    }, [dispatch, ensureGroup]);

    const updateDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawing) return false;
        const segId = activeSegmentIdRef.current;
        if (!segId) return false;

        const p = getPointerLocal(e);
        if (!p) return false;

        dispatch(updateSegment({ id: segId, updates: { x: p.x, y: p.y } }));
        return true;
    }, [dispatch, isDrawing]);

    const finishDrawing = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawing) return false;

        const p = getPointerLocal(e);
        if (p && activeSegmentIdRef.current) {
            dispatch(updateSegment({ id: activeSegmentIdRef.current, updates: { x: p.x, y: p.y } }));
        }

        setIsDrawing(false);
        // 세션 유지: activeGroupIdRef는 선택 유지, 세그먼트 id만 초기화
        activeSegmentIdRef.current = null;
        return true;
    }, [dispatch, isDrawing]);

    const cancelDrawing = useCallback(() => {
        setIsDrawing(false);
        activeSegmentIdRef.current = null;
        // 그룹은 유지하여 이어 그리기 가능하게 함
    }, []);

    return {
        isDrawing,
        startDrawing,
        updateDrawing,
        finishDrawing,
        cancelDrawing,
    };
}