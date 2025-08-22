import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import {
    setPathGroups,
    updatePathGroups,
    addSegment,
    removeSegment,
    updateSegment,
    splitSegment,
    setSelectedSegment,
    setSelectedGroup,
    setSelectedEndpoint,
    setTool,
    undo,
    redo,
    toggleGroupVisibility,
    toggleGroupLock,
    removePathGroup,
    updatePathGroup,
} from '@/store/slices/path-slice';
import { PathGroup, PathSegment } from '@/types/gcode-path';

export function useReduxPathEditor() {
    const dispatch = useDispatch<AppDispatch>();

    const {
        pathGroups,
        selectedSegmentId,
        selectedGroupId,
        selectedEndpoint,
        tool,
        history,
        historyIndex,
        isGenerating,
        lastModified,
        lastGeneratedFromShapes,
    } = useSelector((state: RootState) => state.path);

    // 히스토리 상태
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    // Shape 변경 감지를 위한 shapes 상태
    const { lastModified: shapesLastModified } = useSelector((state: RootState) => state.shapes);
    const hasUnsavedChanges = lastGeneratedFromShapes !== null &&
        shapesLastModified > lastGeneratedFromShapes;

    // 액션 핸들러들
    const handleSetPathGroups = useCallback((pathGroups: PathGroup[]) => {
        dispatch(setPathGroups(pathGroups));
    }, [dispatch]);

    const handleUpdatePathGroups = useCallback((pathGroups: PathGroup[]) => {
        dispatch(updatePathGroups(pathGroups));
    }, [dispatch]);

    const handleGroupSelect = useCallback((groupId: string) => {
        dispatch(setSelectedGroup(groupId || null));
    }, [dispatch]);

    const handleSegmentSelect = useCallback((segmentId: string) => {
        dispatch(setSelectedSegment(segmentId || null));
    }, [dispatch]);

    const handleEndpointDrag = useCallback((
        segmentId: string,
        endpoint: 'start' | 'end',
        newPos: { x: number; y: number }
    ) => {
        dispatch(updateSegment({
            id: segmentId,
            updates: { [endpoint]: newPos }
        }));
    }, [dispatch]);

    const handleSegmentSplit = useCallback((segmentId: string, splitPoint: { x: number; y: number }) => {
        dispatch(splitSegment({ segmentId, splitPoint }));
    }, [dispatch]);

    const handleSegmentMerge = useCallback((segmentId1: string, segmentId2: string) => {
        // 병합 로직은 복잡하므로 별도 thunk로 구현하거나
        // 여기서 직접 구현
        const group = pathGroups.find(g =>
            g.segments.some(s => s.id === segmentId1) &&
            g.segments.some(s => s.id === segmentId2)
        );

        if (!group) return;

        const seg1 = group.segments.find(s => s.id === segmentId1);
        const seg2 = group.segments.find(s => s.id === segmentId2);

        if (!seg1 || !seg2) return;

        // 연결 가능한지 확인
        const canMerge = (
            (Math.abs(seg1.end.x - seg2.start.x) < 0.01 && Math.abs(seg1.end.y - seg2.start.y) < 0.01) ||
            (Math.abs(seg1.start.x - seg2.end.x) < 0.01 && Math.abs(seg1.start.y - seg2.end.y) < 0.01)
        );

        if (!canMerge) return;

        const mergedSegment: PathSegment = {
            id: `merged-${Date.now()}`,
            start: seg1.start,
            end: seg2.end,
            type: seg1.type,
            speed: seg1.speed,
            z: seg1.z,
            feedRate: seg1.feedRate,
            comment: `${seg1.comment || ''} + ${seg2.comment || ''}`
        };

        const newSegments = group.segments
            .filter(s => s.id !== segmentId1 && s.id !== segmentId2)
            .concat([mergedSegment]);

        dispatch(updatePathGroup({
            id: group.id,
            updates: { segments: newSegments }
        }));
    }, [dispatch, pathGroups]);

    const handleSegmentDelete = useCallback((segmentId?: string) => {
        const targetId = segmentId || selectedSegmentId;
        if (targetId) {
            dispatch(removeSegment(targetId));
        }
    }, [dispatch, selectedSegmentId]);

    const handleAddSegment = useCallback((
        groupId: string,
        segmentData: {
            start: { x: number; y: number };
            end: { x: number; y: number };
            type: 'G0' | 'G1';
        }
    ) => {
        const newSegment: PathSegment = {
            id: `segment-${Date.now()}-${Math.random()}`,
            ...segmentData,
            speed: segmentData.type === 'G0' ? 3000 : 1000,
            z: segmentData.type === 'G0' ? 5 : 0,
            feedRate: segmentData.type === 'G0' ? 3000 : 1000,
        };

        dispatch(addSegment({ groupId, segment: newSegment }));
    }, [dispatch]);

    const handleGroupVisibilityToggle = useCallback((groupId: string) => {
        dispatch(toggleGroupVisibility(groupId));
    }, [dispatch]);

    const handleGroupLockToggle = useCallback((groupId: string) => {
        dispatch(toggleGroupLock(groupId));
    }, [dispatch]);

    const handleGroupDelete = useCallback((groupId: string) => {
        dispatch(removePathGroup(groupId));
    }, [dispatch]);

    const handleSegmentUpdate = useCallback((segmentId: string, updates: Partial<PathSegment>) => {
        dispatch(updateSegment({ id: segmentId, updates }));
    }, [dispatch]);

    const handleGroupUpdate = useCallback((groupId: string, updates: Partial<PathGroup>) => {
        dispatch(updatePathGroup({ id: groupId, updates }));
    }, [dispatch]);

    const handleUndo = useCallback(() => {
        dispatch(undo());
    }, [dispatch]);

    const handleRedo = useCallback(() => {
        dispatch(redo());
    }, [dispatch]);

    const handleSetTool = useCallback((tool: 'select' | 'add' | 'delete' | 'split' | 'merge') => {
        dispatch(setTool(tool));
    }, [dispatch]);

    return {
        // 상태
        pathGroups,
        selectedSegmentId,
        selectedGroupId,
        selectedEndpoint,
        tool,
        canUndo,
        canRedo,
        isGenerating,
        hasUnsavedChanges,

        // 액션 핸들러
        handleSetPathGroups,
        handleUpdatePathGroups,
        handleGroupSelect,
        handleSegmentSelect,
        handleEndpointDrag,
        handleSegmentSplit,
        handleSegmentMerge,
        handleSegmentDelete,
        handleAddSegment,
        handleGroupVisibilityToggle,
        handleGroupLockToggle,
        handleGroupDelete,
        handleSegmentUpdate,
        handleGroupUpdate,
        handleUndo,
        handleRedo,
        handleSetTool,
    };
}