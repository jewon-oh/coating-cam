import { useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { addPathGroup, removePathGroup, removeSegment, setSelectedPath, setSelectedSegment, updatePathGroups } from '@/store/slices/path-slice';
import type { PathGroup, PathSegment } from '@/types/path';

type ClipboardData = {
    type: 'group' | 'segments';
    group?: PathGroup;
    segments?: PathSegment[];
};

export function usePathEditing() {
    const dispatch = useAppDispatch();
    const { pathGroups, selectedPathId, selectedSegmentId } = useAppSelector((s) => s.paths);
    const clipboardRef = useRef<ClipboardData | null>(null);

    const handleDelete = useCallback(() => {
        if (selectedSegmentId) {
            dispatch(removeSegment(selectedSegmentId));
            dispatch(setSelectedSegment(null));
            return;
        }
        if (selectedPathId) {
            dispatch(removePathGroup(selectedPathId));
            dispatch(setSelectedPath(null));
        }
    }, [dispatch, selectedPathId, selectedSegmentId]);

    const handleCopy = useCallback(() => {
        if (selectedSegmentId && selectedPathId) {
            const group = pathGroups.find(g => g.id === selectedPathId);
            const seg = group?.segments.find(s => s.id === selectedSegmentId);
            if (!seg) return;
            clipboardRef.current = { type: 'segments', segments: [{ ...seg }] };
            return;
        }
        if (selectedPathId) {
            const group = pathGroups.find(g => g.id === selectedPathId);
            if (!group) return;
            clipboardRef.current = { type: 'group', group: { ...group, segments: group.segments.map(s => ({ ...s })) } };
        }
    }, [pathGroups, selectedPathId, selectedSegmentId]);

    const handleCut = useCallback(() => {
        handleCopy();
        handleDelete();
    }, [handleCopy, handleDelete]);

    const handlePaste = useCallback(() => {
        const data = clipboardRef.current;
        if (!data) return;

        // 새 ID 생성기
        const newId = () => (globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);

        if (data.type === 'group' && data.group) {
            const g: PathGroup = {
                ...data.group,
                id: newId(),
                name: `${data.group.name} (복사)`,
                segments: data.group.segments.map(s => ({ ...s, id: newId() }))
            };
            dispatch(addPathGroup(g));
            dispatch(setSelectedPath(g.id));
            dispatch(setSelectedSegment(null));
            return;
        }

        if (data.type === 'segments' && data.segments?.length) {
            if (!selectedPathId) {
                // 선택된 그룹이 없다면 새 그룹 만들어 붙여넣기
                const g: PathGroup = {
                    id: newId(),
                    name: `Path #${pathGroups.length + 1}`,
                    color: '#1976d2',
                    visible: true,
                    tool: 'pen',
                    speed: 1000,
                    power: 100,
                    passes: 1,
                    segments: data.segments.map(s => ({ ...s, id: newId() }))
                } as PathGroup;
                dispatch(addPathGroup(g));
                dispatch(setSelectedPath(g.id));
                dispatch(setSelectedSegment(null));
            } else {
                // 선택된 그룹에 추가
                const updates = [{
                    id: selectedPathId,
                    segments: [
                        ...(pathGroups.find(g => g.id === selectedPathId)?.segments ?? []),
                        ...data.segments.map(s => ({ ...s, id: newId() })),
                    ],
                } as Partial<PathGroup>];
                dispatch(updatePathGroups(updates));
            }
        }
    }, [dispatch, pathGroups, selectedPathId]);

    const hasClipboardData = !!clipboardRef.current;

    return {
        handleDelete,
        handleCopy,
        handleCut,
        handlePaste,
        hasClipboardData,
    };
}