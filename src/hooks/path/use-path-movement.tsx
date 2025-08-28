import { useCallback, useRef } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateSegment } from '@/store/slices/path-slice';

type Endpoint = 'start' | 'end';

export function usePathMovement() {
    const dispatch = useAppDispatch();
    const { selectedPathId, selectedSegmentId, pathGroups } = useAppSelector((s) => s.paths);

    const dragState = useRef<{ segmentId: string | null; endpoint: Endpoint | 'segment' | null }>({
        segmentId: null,
        endpoint: null,
    });

    // 세그먼트 전체 드래그 시작
    const handleDragStart = useCallback((segmentId?: string) => {
        dragState.current.segmentId = segmentId ?? selectedSegmentId ?? null;
        dragState.current.endpoint = 'segment';
    }, [selectedSegmentId]);

    // 세그먼트 전체 드래그(평행이동)
    const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        if (!dragState.current.segmentId || dragState.current.endpoint !== 'segment') return;

        const dx = e.evt.movementX ?? 0;
        const dy = e.evt.movementY ?? 0;

        // Stage 좌표계 보정(스크린 픽셀 -> 로컬 좌표)
        const stage = e.target.getStage();
        if (!stage) return;
        const scaleX = stage.scaleX() || 1;
        const scaleY = stage.scaleY() || 1;
        const localDx = dx / scaleX;
        const localDy = dy / scaleY;

        const segId = dragState.current.segmentId;
        const group = pathGroups.find(g => g.segments.some(s => s.id === segId));
        const seg = group?.segments.find(s => s.id === segId);
        if (!seg) return;

        if ('start' in seg && 'end' in seg) {
            dispatch(updateSegment({
                id: segId,
                updates: {
                    start: { x: (seg.start?.x ?? 0) + localDx, y: (seg.start?.y ?? 0) + localDy },
                    end: { x: (seg.end?.x ?? 0) + localDx, y: (seg.end?.y ?? 0) + localDy },
                }
            }));
        } else {
            // 포인트 타입(line 포인트 등)
            dispatch(updateSegment({
                id: segId,
                updates: {
                    x: (seg.x ?? 0) + localDx,
                    y: (seg.y ?? 0) + localDy,
                }
            }));
        }
    }, [dispatch, pathGroups]);

    const handleDragEnd = useCallback(() => {
        dragState.current.segmentId = null;
        dragState.current.endpoint = null;
    }, []);

    // 엔드포인트 드래그(노드 이동)
    const handleEndpointDrag = useCallback((segmentId: string, endpoint: Endpoint, pos: { x: number; y: number }) => {
        const group = pathGroups.find(g => g.segments.some(s => s.id === segmentId));
        const seg = group?.segments.find(s => s.id === segmentId);
        if (!seg) return;

        const updates: any = {};
        if ('start' in seg && 'end' in seg) {
            updates[endpoint] = { x: pos.x, y: pos.y };
        } else {
            // 포인트 단일 타입이면 x,y로 갱신
            updates.x = pos.x;
            updates.y = pos.y;
        }
        dispatch(updateSegment({ id: segmentId, updates }));
    }, [dispatch, pathGroups]);

    // 방향키로 Nudging (전체 그룹 이동)
    const handleNudge = useCallback((direction: 'up' | 'down' | 'left' | 'right', step = 1) => {
        if (!selectedPathId) return;
        const group = pathGroups.find(g => g.id === selectedPathId);
        if (!group) return;

        const delta =
            direction === 'up' ? { dx: 0, dy: -step } :
                direction === 'down' ? { dx: 0, dy: step } :
                    direction === 'left' ? { dx: -step, dy: 0 } :
                        { dx: step, dy: 0 };

        for (const seg of group.segments) {
            if ('start' in seg && 'end' in seg) {
                dispatch(updateSegment({
                    id: seg.id,
                    updates: {
                        start: { x: (seg.start?.x ?? 0) + delta.dx, y: (seg.start?.y ?? 0) + delta.dy },
                        end: { x: (seg.end?.x ?? 0) + delta.dx, y: (seg.end?.y ?? 0) + delta.dy },
                    }
                }));
            } else {
                dispatch(updateSegment({
                    id: seg.id,
                    updates: { x: (seg.x ?? 0) + delta.dx, y: (seg.y ?? 0) + delta.dy }
                }));
            }
        }
    }, [dispatch, pathGroups, selectedPathId]);

    return {
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleEndpointDrag,
        handleNudge,
    };
}