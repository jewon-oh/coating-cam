// src/hooks/use-shape-editing.tsx
import React, { useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
    removeShapes,
    setAllShapes,
    selectMultipleShapes,
    unselectAllShapes
} from '@/store/slices/shape-slice';
import { setPresent } from '@/store/slices/shape-history-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';

// 클립보드 타입 정의
type ClipboardGroupsPayload = {
    kind: 'groups';
    groups: Array<{ group: CustomShapeConfig; members: CustomShapeConfig[] }>
};
type ClipboardShapesPayload = {
    kind: 'shapes';
    items: CustomShapeConfig[]
};
type ClipboardPayload = ClipboardGroupsPayload | ClipboardShapesPayload | null;

export function useShapeEditing() {
    const dispatch = useAppDispatch();
    const { shapes, selectedShapeIds } = useAppSelector((state) => state.shapes);

    const shapesRef = useRef(shapes);
    React.useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);

    // 클립보드 참조
    const clipboardRef = useRef<ClipboardPayload>(null);

    // 선택된 도형들을 그룹으로 수집하는 유틸리티
    const collectDescendants = useCallback((parentId: string, childrenByParent: Map<string | null, CustomShapeConfig[]>): CustomShapeConfig[] => {
        const out: CustomShapeConfig[] = [];
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
    }, []);

    // 삭제
    const handleDelete = useCallback(() => {
        if (selectedShapeIds.length === 0) return;
        dispatch(removeShapes(selectedShapeIds));
        const remain = shapesRef.current.filter(s => !selectedShapeIds.includes(s.id!));
        dispatch(setPresent(remain));
        dispatch(unselectAllShapes());
    }, [dispatch, selectedShapeIds]);

    // 복사
    const handleCopy = useCallback(() => {
        const current = shapesRef.current || [];
        const selectedSet = new Set(selectedShapeIds);
        if (!selectedSet.size) {
            clipboardRef.current = null;
            return;
        }

        // 그룹 멤버십을 계산하기 위한 자식 맵 구축
        const childrenByParent = new Map<string | null, CustomShapeConfig[]>();
        current.forEach(s => {
            const p = s.parentId || null;
            const arr = childrenByParent.get(p) || [];
            arr.push(s);
            childrenByParent.set(p, arr);
        });

        // 선택된 항목이 완전한 그룹과 일치하는지 확인
        const groups = current.filter(s => s.type === 'group');
        const remaining = new Set(selectedSet);
        const matchedGroups: Array<{ group: CustomShapeConfig; members: CustomShapeConfig[] }> = [];

        for (const g of groups) {
            const members = collectDescendants(g.id!, childrenByParent);
            if (members.length === 0) continue;
            const memberIds = new Set(members.map(m => m.id!));
            const isSubset = Array.from(memberIds).every(id => selectedSet.has(id));

            if (isSubset) {
                let canTake = true;
                for (const id of memberIds) {
                    if (!remaining.has(id)) {
                        canTake = false;
                        break;
                    }
                }
                if (canTake) {
                    for (const id of memberIds) remaining.delete(id);
                    matchedGroups.push({ group: g, members });
                }
            }
        }

        if (matchedGroups.length > 0 && remaining.size === 0) {
            clipboardRef.current = { kind: 'groups', groups: matchedGroups };
            return;
        }

        // 폴백: 선택된 도형들을 그대로 복사 (그룹 제외)
        const items = current.filter((s) => selectedSet.has(s.id!) && s.type !== 'group');
        clipboardRef.current = { kind: 'shapes', items };
    }, [selectedShapeIds, collectDescendants]);

    // 붙여넣기
    const handlePaste = useCallback(() => {
        const payload = clipboardRef.current;
        if (!payload) return;

        const base = shapesRef.current || [];

        if (payload.kind === 'groups') {
            const additions: CustomShapeConfig[] = [];
            const newSelectIds: string[] = [];

            for (const { group, members } of payload.groups as Array<{
                group: CustomShapeConfig;
                members: CustomShapeConfig[]
            }>) {
                const newGroupId = crypto.randomUUID();
                const newGroup: CustomShapeConfig = {
                    id: newGroupId,
                    parentId: null,
                    type: 'group',
                    name: `${group.name || 'Group'} Copy`,
                    listening: false,
                    visible: true,
                    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
                } as CustomShapeConfig;
                additions.push(newGroup);

                for (const m of members) {
                    const newId = crypto.randomUUID();
                    const dup: CustomShapeConfig = {
                        ...m,
                        id: newId,
                        parentId: newGroupId,
                        name: `${m.name || m.type} Copy`,
                        x: (m.x || 0) + 20,
                        y: (m.y || 0) + 20,
                    } as CustomShapeConfig;
                    additions.push(dup);
                    newSelectIds.push(newId);
                }
            }

            const next = [...base, ...additions] as CustomShapeConfig[];
            dispatch(setAllShapes(next));
            dispatch(setPresent(next));
            dispatch(selectMultipleShapes(newSelectIds));
            return;
        }

        if (payload.kind === 'shapes') {
            const pasted = (payload.items as CustomShapeConfig[]).map((s) => ({
                ...s,
                id: crypto.randomUUID(),
                name: `${s.name} Copy`,
                x: (s.x || 0) + 20,
                y: (s.y || 0) + 20,
            }));
            const next = [...base, ...pasted] as CustomShapeConfig[];
            dispatch(setAllShapes(next));
            dispatch(setPresent(next));
            dispatch(selectMultipleShapes(pasted.map((p) => p.id!)));
        }
    }, [dispatch]);

    // 잘라내기
    const handleCut = useCallback(() => {
        if (!selectedShapeIds.length) return;
        handleCopy();
        const remaining = shapesRef.current.filter((s) => !selectedShapeIds.includes(s.id!));
        dispatch(removeShapes(selectedShapeIds));
        dispatch(setPresent(remaining));
    }, [dispatch, selectedShapeIds, handleCopy]);

    // 그룹화
    const handleGroup = useCallback(() => {
        if (selectedShapeIds.length < 2) return;

        const current = shapesRef.current || [];
        const selectedShapes = current.filter(s => selectedShapeIds.includes(s.id!));
        const existingGroupIds = new Set(
            selectedShapes
                .map(s => s.parentId)
                .filter((pid): pid is string => !!pid)
                .filter(pid => current.some(x => x.id === pid && x.type === 'group'))
        );

        let next: CustomShapeConfig[];
        const memberIds = selectedShapes.filter(s => s.type !== 'group').map(s => s.id!);

        if (existingGroupIds.size === 1) {
            // 병합: 선택된 모든 도형을 기존 단일 그룹에 추가
            const targetGroupId = Array.from(existingGroupIds)[0];
            next = current.map(s => (memberIds.includes(s.id!) ? {
                ...s,
                parentId: targetGroupId
            } : s)) as CustomShapeConfig[];
            dispatch(setAllShapes(next));
            dispatch(setPresent(next));
            dispatch(selectMultipleShapes(memberIds));
            return;
        }

        // 폴백: 새 논리 그룹 생성
        const groupId = crypto.randomUUID();
        const groupNode: CustomShapeConfig = {
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
        } as unknown as CustomShapeConfig;

        next = [...current.map(s => (memberIds.includes(s.id!) ? {
            ...s,
            parentId: groupId
        } : s)), groupNode] as CustomShapeConfig[];
        dispatch(setAllShapes(next));
        dispatch(setPresent(next));
        dispatch(selectMultipleShapes(memberIds));
    }, [dispatch, selectedShapeIds]);

    // 그룹 해제
    const handleUngroup = useCallback(() => {
        if (selectedShapeIds.length === 0) return;

        const current = shapesRef.current || [];
        const selectedShapes = current.filter(s => selectedShapeIds.includes(s.id!));
        const groupIds = new Set(
            selectedShapes
                .map(s => s.parentId)
                .filter((pid): pid is string => !!pid)
        );

        if (groupIds.size === 0) return;

        // 그룹에서 제거
        let next = current.map(s => {
            if (selectedShapeIds.includes(s.id!) && s.parentId && groupIds.has(s.parentId)) {
                return { ...s, parentId: null };
            }
            return s;
        });

        // 빈 그룹들 제거
        const usedGroupIds = new Set(next.map(s => s.parentId).filter(Boolean));
        next = next.filter(s => s.type !== 'group' || usedGroupIds.has(s.id!));

        dispatch(setAllShapes(next as CustomShapeConfig[]));
        dispatch(setPresent(next as CustomShapeConfig[]));
    }, [dispatch, selectedShapeIds]);

    return {
        selectedShapeIds,
        handleDelete,
        handleCopy,
        handlePaste,
        handleCut,
        handleGroup,
        handleUngroup,
        hasClipboardData: clipboardRef.current !== null,
    };
}