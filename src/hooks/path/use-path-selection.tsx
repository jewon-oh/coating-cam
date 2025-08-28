import { useCallback, useRef, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setSelectedPath, setSelectedSegment } from '@/store/slices/path-slice';

type Endpoint = 'start' | 'end';

export function usePathSelection() {
    const dispatch = useAppDispatch();
    const { pathGroups, selectedPathId, selectedSegmentId } = useAppSelector((s) => s.paths);

    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);

    const getPointerLocal = (e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return null;
        const pt = stage.getPointerPosition();
        if (!pt) return null;
        const transform = stage.getAbsoluteTransform().copy().invert();
        return transform.point(pt);
    };

    // 단일 클릭으로 PathGroup 선택
    const handleGroupSelect = useCallback((groupId: string | null) => {
        dispatch(setSelectedSegment(null));
        dispatch(setSelectedPath(groupId));
    }, [dispatch]);

    // 단일 클릭으로 Segment 선택
    const handleSegmentSelect = useCallback((segmentId: string | null, groupId?: string) => {
        if (groupId) dispatch(setSelectedPath(groupId));
        dispatch(setSelectedSegment(segmentId));
    }, [dispatch]);

    // Stage 빈 공간 클릭 시 모두 해제
    const handleCanvasClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (e.target === e.target.getStage()) {
            dispatch(setSelectedSegment(null));
            dispatch(setSelectedPath(null));
        }
    }, [dispatch]);

    // 박스 드래그 선택 시작(간단 구현: 경계 내 첫 번째 PathGroup 선택)
    const startDragSelection = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage || e.target !== stage) return false;

        const local = getPointerLocal(e);
        if (!local) return false;

        dragStartRef.current = { x: local.x, y: local.y };
        setIsDragSelecting(true);
        return true;
    }, []);

    const updateDragSelection = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDragSelecting || !dragStartRef.current) return false;
        // 미리보기 사각형 UI는 현재 구현 범위 밖(필요 시 별도 temp layer에서 draw)
        return true;
    }, [isDragSelecting]);

    const finishDragSelection = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDragSelecting || !dragStartRef.current) return false;

        const local = getPointerLocal(e);
        if (!local) {
            setIsDragSelecting(false);
            dragStartRef.current = null;
            return false;
        }

        const x1 = Math.min(dragStartRef.current.x, local.x);
        const y1 = Math.min(dragStartRef.current.y, local.y);
        const x2 = Math.max(dragStartRef.current.x, local.x);
        const y2 = Math.max(dragStartRef.current.y, local.y);

        // 사각형과 교차하는 첫 번째 그룹 선택 (간단 규칙)
        let pickedGroup: string | null = null;
        outer: for (const g of pathGroups) {
            for (const seg of g.segments) {
                const minX = Math.min(seg.start?.x ?? seg.x ?? 0, seg.end?.x ?? seg.x ?? 0);
                const maxX = Math.max(seg.start?.x ?? seg.x ?? 0, seg.end?.x ?? seg.x ?? 0);
                const minY = Math.min(seg.start?.y ?? seg.y ?? 0, seg.end?.y ?? seg.y ?? 0);
                const maxY = Math.max(seg.start?.y ?? seg.y ?? 0, seg.end?.y ?? seg.y ?? 0);
                const intersect = !(x2 < minX || maxX < x1 || y2 < minY || maxY < y1);
                if (intersect) {
                    pickedGroup = g.id;
                    break outer;
                }
            }
        }

        dispatch(setSelectedSegment(null));
        dispatch(setSelectedPath(pickedGroup));

        setIsDragSelecting(false);
        dragStartRef.current = null;
        return true;
    }, [dispatch, isDragSelecting, pathGroups]);

    const cancelDragSelection = useCallback(() => {
        if (isDragSelecting) {
            setIsDragSelecting(false);
            dragStartRef.current = null;
        }
    }, [isDragSelecting]);

    const handleSelectAll = useCallback(() => {
        // 간단: 첫 번째 그룹 선택
        const firstGroup = pathGroups[0]?.id ?? null;
        dispatch(setSelectedSegment(null));
        dispatch(setSelectedPath(firstGroup));
    }, [dispatch, pathGroups]);

    // 특정 엔드포인트 선택(노드 편집용)
    const handleEndpointSelect = useCallback((segmentId: string, endpoint: Endpoint, groupId?: string) => {
        if (groupId) dispatch(setSelectedPath(groupId));
        dispatch(setSelectedSegment(segmentId));
    }, [dispatch]);

    return {
        isDragSelecting,
        startDragSelection,
        updateDragSelection,
        finishDragSelection,
        cancelDragSelection,

        handleGroupSelect,
        handleSegmentSelect,
        handleEndpointSelect,
        handleCanvasClick,
        handleSelectAll,

        selectedPathId,
        selectedSegmentId,
    };
}