import React, { useCallback, useRef } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { batchUpdateSegments, updateSegment } from '@/store/slices/path-slice';
import { useSettings } from '@/contexts/settings-context';

type Endpoint = 'start' | 'end';

export function usePathMovement() {
    const dispatch = useAppDispatch();
    const { selectedPathId, selectedSegmentId, pathGroups } = useAppSelector((s) => s.paths);
    const { isSnappingEnabled, gridSize } = useSettings();

    const pathGroupsRef = useRef(pathGroups);
    React.useEffect(() => {
        pathGroupsRef.current = pathGroups;
    }, [pathGroups]);

    // 드래그 시작 위치 저장용
    const dragStartPositionsRef = useRef<Map<string, {
        start?: { x: number; y: number };
        end?: { x: number; y: number };
        x?: number;
        y?: number;
    }>>(new Map());

    // 스냅 함수
    const snap = useCallback(
        (v: number) => (isSnappingEnabled ? Math.round(v / gridSize) * gridSize : v),
        [isSnappingEnabled, gridSize]
    );

    // 드래그 시작 핸들러
    const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const segmentId = node.id();

        const group = pathGroupsRef.current.find(g => g.segments?.some(s => s.id === segmentId));
        const segment = group?.segments?.find(s => s.id === segmentId);

        if (segment) {
            if ('start' in segment && 'end' in segment) {
                dragStartPositionsRef.current.set(segmentId, {
                    start: { x: segment.start?.x ?? 0, y: segment.start?.y ?? 0 },
                    end: { x: segment.end?.x ?? 0, y: segment.end?.y ?? 0 }
                });
            } else {
                dragStartPositionsRef.current.set(segmentId, {
                    x: segment.x ?? 0,
                    y: segment.y ?? 0
                });
            }
        }
    }, []);

    // 드래그 이동 중 스냅 적용
    const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        // Transformer가 변형을 처리하므로 여기서는 스냅핑만 적용
        if (isSnappingEnabled) {
            const node = e.target as Konva.Node & {
                points: () => number[];
                points: (points: number[]) => void;
            };

            if (node.points) {
                const points = node.points();
                const snappedPoints = [
                    snap(points[0]), snap(points[1]),
                    snap(points[2]), snap(points[3])
                ];

                if (snappedPoints.some((p, i) => p !== points[i])) {
                    node.points(snappedPoints);
                    node.getLayer()?.batchDraw();
                }
            }
        }
    }, [snap, isSnappingEnabled]);

    // 드래그 종료 핸들러 - 실제 이동했을 때만 업데이트
    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const segmentId = node.id();

        const group = pathGroupsRef.current.find(g => g.segments?.some(s => s.id === segmentId));
        const segment = group?.segments?.find(s => s.id === segmentId);

        if (!segment) return;

        const startPos = dragStartPositionsRef.current.get(segmentId);
        if (!startPos) return;

        // 실제로 이동했는지 확인
        let hasMoved = false;
        const updates: any = {};

        if ('start' in segment && 'end' in segment) {
            const currentStart = { x: segment.start?.x ?? 0, y: segment.start?.y ?? 0 };
            const currentEnd = { x: segment.end?.x ?? 0, y: segment.end?.y ?? 0 };

            hasMoved = startPos.start && (
                Math.abs(currentStart.x - startPos.start.x) > 0.5 ||
                Math.abs(currentStart.y - startPos.start.y) > 0.5 ||
                Math.abs(currentEnd.x - (startPos.end?.x ?? 0)) > 0.5 ||
                Math.abs(currentEnd.y - (startPos.end?.y ?? 0)) > 0.5
            );

            if (hasMoved) {
                updates.start = { x: snap(currentStart.x), y: snap(currentStart.y) };
                updates.end = { x: snap(currentEnd.x), y: snap(currentEnd.y) };
            }
        } else {
            const currentPos = { x: segment.x ?? 0, y: segment.y ?? 0 };

            hasMoved = Math.abs(currentPos.x - (startPos.x ?? 0)) > 0.5 ||
                Math.abs(currentPos.y - (startPos.y ?? 0)) > 0.5;

            if (hasMoved) {
                updates.x = snap(currentPos.x);
                updates.y = snap(currentPos.y);
            }
        }

        if (hasMoved && Object.keys(updates).length > 0) {
            dispatch(updateSegment({
                segmentId: segmentId,
                updates
            }));
        }

        // 시작 위치 정리
        dragStartPositionsRef.current.delete(segmentId);
    }, [dispatch, snap]);

    // 엔드포인트 직접 드래그 (Transformer의 앵커 포인트 조작)
    const handleEndpointDrag = useCallback((segmentId: string, endpoint: Endpoint, pos: { x: number; y: number }) => {
        const group = pathGroupsRef.current.find(g => g.segments?.some(s => s.id === segmentId));
        const segment = group?.segments?.find(s => s.id === segmentId);
        if (!segment) return;

        const snappedPos = { x: snap(pos.x), y: snap(pos.y) };
        const updates: any = {};

        if ('start' in segment && 'end' in segment) {
            updates[endpoint] = snappedPos;
        } else {
            // 포인트 단일 타입이면 x,y로 갱신
            updates.x = snappedPos.x;
            updates.y = snappedPos.y;
        }

        dispatch(updateSegment({
            segmentId: segmentId,
            updates
        }));
    }, [dispatch, snap]);

    // 키보드를 통한 미세 이동 (선택된 segment 또는 전체 path)
    const handleNudge = useCallback((direction: 'up' | 'down' | 'left' | 'right', distance = 1) => {
        let deltaX = 0;
        let deltaY = 0;

        switch (direction) {
            case 'up':
                deltaY = -distance;
                break;
            case 'down':
                deltaY = distance;
                break;
            case 'left':
                deltaX = -distance;
                break;
            case 'right':
                deltaX = distance;
                break;
        }

        const updates: Array<{ segmentId: string; updates: any }> = [];

        if (selectedSegmentId) {
            // 단일 segment 이동
            const group = pathGroupsRef.current.find(g => g.segments?.some(s => s.id === selectedSegmentId));
            const segment = group?.segments?.find(s => s.id === selectedSegmentId);

            if (segment) {
                if ('start' in segment && 'end' in segment) {
                    const newStart = {
                        x: snap((segment.start?.x ?? 0) + deltaX),
                        y: snap((segment.start?.y ?? 0) + deltaY)
                    };
                    const newEnd = {
                        x: snap((segment.end?.x ?? 0) + deltaX),
                        y: snap((segment.end?.y ?? 0) + deltaY)
                    };
                    updates.push({
                        segmentId: selectedSegmentId,
                        updates: { start: newStart, end: newEnd }
                    });
                } else {
                    updates.push({
                        segmentId: selectedSegmentId,
                        updates: {
                            x: snap((segment.x ?? 0) + deltaX),
                            y: snap((segment.y ?? 0) + deltaY)
                        }
                    });
                }
            }
        } else if (selectedPathId) {
            // 전체 path group 이동
            const group = pathGroupsRef.current.find(g => g.id === selectedPathId);

            if (group?.segments) {
                group.segments.forEach(segment => {
                    if ('start' in segment && 'end' in segment) {
                        const newStart = {
                            x: snap((segment.start?.x ?? 0) + deltaX),
                            y: snap((segment.start?.y ?? 0) + deltaY)
                        };
                        const newEnd = {
                            x: snap((segment.end?.x ?? 0) + deltaX),
                            y: snap((segment.end?.y ?? 0) + deltaY)
                        };
                        updates.push({
                            segmentId: segment.id,
                            updates: { start: newStart, end: newEnd }
                        });
                    } else {
                        updates.push({
                            segmentId: segment.id,
                            updates: {
                                x: snap((segment.x ?? 0) + deltaX),
                                y: snap((segment.y ?? 0) + deltaY)
                            }
                        });
                    }
                });
            }
        }

        if (updates.length > 0) {
            // 배치 업데이트 (성능 최적화)
            if (updates.length === 1) {
                dispatch(updateSegment(updates[0]));
            } else {
                dispatch(batchUpdateSegments(updates));
            }
        }
    }, [selectedSegmentId, selectedPathId, snap, dispatch]);

    // 세그먼트를 특정 위치로 이동
    const moveSegmentTo = useCallback((segmentId: string, position: { x: number; y: number }) => {
        const group = pathGroupsRef.current.find(g => g.segments?.some(s => s.id === segmentId));
        const segment = group?.segments?.find(s => s.id === segmentId);
        if (!segment) return;

        const snappedPos = { x: snap(position.x), y: snap(position.y) };
        const updates: any = {};

        if ('start' in segment && 'end' in segment) {
            // 라인 세그먼트의 경우 중심점을 기준으로 이동
            const currentCenterX = ((segment.start?.x ?? 0) + (segment.end?.x ?? 0)) / 2;
            const currentCenterY = ((segment.start?.y ?? 0) + (segment.end?.y ?? 0)) / 2;

            const deltaX = snappedPos.x - currentCenterX;
            const deltaY = snappedPos.y - currentCenterY;

            updates.start = {
                x: (segment.start?.x ?? 0) + deltaX,
                y: (segment.start?.y ?? 0) + deltaY
            };
            updates.end = {
                x: (segment.end?.x ?? 0) + deltaX,
                y: (segment.end?.y ?? 0) + deltaY
            };
        } else {
            updates.x = snappedPos.x;
            updates.y = snappedPos.y;
        }

        dispatch(updateSegment({
            segmentId: segmentId,
            updates
        }));
    }, [snap, dispatch]);

    // 여러 세그먼트를 특정 위치로 이동
    const moveSegmentsTo = useCallback((segmentIds: string[], positions: Array<{ x: number; y: number }>) => {
        const updates: Array<{ segmentId: string; updates: any }> = [];

        segmentIds.forEach((segmentId, index) => {
            if (positions[index]) {
                const group = pathGroupsRef.current.find(g => g.segments?.some(s => s.id === segmentId));
                const segment = group?.segments?.find(s => s.id === segmentId);

                if (segment) {
                    const snappedPos = { x: snap(positions[index].x), y: snap(positions[index].y) };

                    if ('start' in segment && 'end' in segment) {
                        const currentCenterX = ((segment.start?.x ?? 0) + (segment.end?.x ?? 0)) / 2;
                        const currentCenterY = ((segment.start?.y ?? 0) + (segment.end?.y ?? 0)) / 2;

                        const deltaX = snappedPos.x - currentCenterX;
                        const deltaY = snappedPos.y - currentCenterY;

                        updates.push({
                            segmentId: segmentId,
                            updates: {
                                start: {
                                    x: (segment.start?.x ?? 0) + deltaX,
                                    y: (segment.start?.y ?? 0) + deltaY
                                },
                                end: {
                                    x: (segment.end?.x ?? 0) + deltaX,
                                    y: (segment.end?.y ?? 0) + deltaY
                                }
                            }
                        });
                    } else {
                        updates.push({
                            segmentId: segmentId,
                            updates: snappedPos
                        });
                    }
                }
            }
        });

        if (updates.length > 0) {
            dispatch(batchUpdateSegments(updates));
        }
    }, [snap, dispatch]);

    return {
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleEndpointDrag,
        handleNudge,
        moveSegmentTo,
        moveSegmentsTo,
        isSnappingEnabled,
    };
}