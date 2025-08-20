
import { useCallback, useState, useRef, useEffect } from 'react';
import { PathSegment, PathGroup } from '@/types/gcode-path';

type Tool = 'select' | 'add' | 'delete';

export function usePathEditor(
    initialPaths: PathGroup[],
    onPathsChange: (paths: PathGroup[]) => void
) {
    const [pathGroups, setPathGroups] = useState<PathGroup[]>(initialPaths);
    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
    const [selectedEndpoint, setSelectedEndpoint] = useState<'start' | 'end' | null>(null);
    const [tool, setTool] = useState<Tool>('select');

    // 히스토리 관리
    const [history, setHistory] = useState<PathGroup[][]>([initialPaths]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // 히스토리에 상태 추가
    const pushHistory = useCallback((newState: PathGroup[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newState);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    // 경로 변경 시 부모 컴포넌트에 알림
    useEffect(() => {
        onPathsChange(pathGroups);
    }, [pathGroups, onPathsChange]);

    // 세그먼트 선택
    const handleSegmentSelect = useCallback((segmentId: string) => {
        setSelectedSegmentId(segmentId);
        setSelectedEndpoint(null);
    }, []);

    // 엔드포인트 드래그
    const handleEndpointDrag = useCallback((
        segmentId: string,
        endpoint: 'start' | 'end',
        newPos: { x: number; y: number }
    ) => {
        setPathGroups(prev => {
            const newGroups = prev.map(group => ({
                ...group,
                segments: group.segments.map(segment => {
                    if (segment.id !== segmentId) return segment;

                    return {
                        ...segment,
                        [endpoint]: newPos
                    };
                })
            }));

            pushHistory(newGroups);
            return newGroups;
        });
    }, [pushHistory]);

    // 세그먼트 삭제
    const handleSegmentDelete = useCallback((segmentId?: string) => {
        const targetId = segmentId || selectedSegmentId;
        if (!targetId) return;

        setPathGroups(prev => {
            const newGroups = prev.map(group => ({
                ...group,
                segments: group.segments.filter(segment => segment.id !== targetId)
            }));

            pushHistory(newGroups);
            return newGroups;
        });

        setSelectedSegmentId(null);
        setSelectedEndpoint(null);
    }, [selectedSegmentId, pushHistory]);

    // 세그먼트 추가
    const handleAddSegment = useCallback((segmentData: {
        start: { x: number; y: number };
        end: { x: number; y: number };
        type: 'G0' | 'G1';
    }) => {
        const newSegment: PathSegment = {
            id: `segment-${Date.now()}-${Math.random()}`,
            ...segmentData,
        };

        setPathGroups(prev => {
            const newGroups = [...prev];
            if (newGroups.length === 0) {
                newGroups.push({
                    id: 'default-group',
                    name: 'Default Group',
                    segments: [newSegment],
                    visible: true,
                    locked: false,
                });
            } else {
                newGroups[0] = {
                    ...newGroups[0],
                    segments: [...newGroups[0].segments, newSegment],
                };
            }

            pushHistory(newGroups);
            return newGroups;
        });

        setSelectedSegmentId(newSegment.id);
    }, [pushHistory]);

    // 실행 취소
    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setPathGroups(history[newIndex]);
        }
    }, [history, historyIndex]);

    // 다시 실행
    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setPathGroups(history[newIndex]);
        }
    }, [history, historyIndex]);

    return {
        pathGroups,
        selectedSegmentId,
        selectedEndpoint,
        tool,
        handleSegmentSelect,
        handleEndpointDrag,
        handleSegmentDelete,
        handleAddSegment,
        handleUndo,
        handleRedo,
        setTool,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
    };
}