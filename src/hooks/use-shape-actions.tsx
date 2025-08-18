import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { toggleShapeLock, toggleShapeVisibility } from '@/store/slices/shapes-slice';
import type { AnyNodeConfig } from '@/types/custom-konva-config';

/**
 * 객체 패널 아이템(도형, 그룹)의 공통 액션(잠금, 가시성 토글)을 관리하는 훅
 * @param shapeId - 액션을 적용할 대상 도형/그룹의 ID
 */
export function useShapeActions(shapeId: string) {
    const dispatch = useAppDispatch();
    const allShapes = useAppSelector(s => s.shapes.shapes);
    const selectedIds = useAppSelector(s => s.shapes.selectedShapeIds);

    // 그룹의 모든 하위 자식 ID를 재귀적으로 찾는 헬퍼 함수
    const collectDescendantIds = useCallback((parentId: string): string[] => {
        const out: string[] = [];
        // 전체 도형 목록을 기반으로 부모-자식 맵을 매번 생성하여 최신 관계를 보장
        const childrenByParent = new Map<string | null, AnyNodeConfig[]>();
        allShapes.forEach(s => {
            const p = s.parentId || null;
            const arr = childrenByParent.get(p) || [];
            arr.push(s);
            childrenByParent.set(p, arr);
        });

        const stack: string[] = [parentId];
        while (stack.length) {
            const pid = stack.pop()!;
            const kids = childrenByParent.get(pid) || [];
            for (const child of kids) {
                if (!child.id) continue;
                out.push(child.id);
                if (child.type === 'group') {
                    stack.push(child.id);
                }
            }
        }
        return out;
    }, [allShapes]);

    // 잠금 상태를 토글하는 함수
    const toggleLock = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        // Shift 키를 누르면 현재 선택된 모든 항목에 적용, 아니면 단일 항목에 적용
        const baseIds = e.shiftKey && selectedIds.length > 0 ? selectedIds : [shapeId];
        const expandedIds = new Set<string>();

        for (const id of baseIds) {
            expandedIds.add(id);
            const node = allShapes.find(s => s.id === id);
            // 대상이 그룹이면 모든 자식 요소를 포함
            if (node && node.type === 'group') {
                collectDescendantIds(id).forEach(d => expandedIds.add(d));
            }
        }
        expandedIds.forEach(id => dispatch(toggleShapeLock(id)));
    }, [dispatch, selectedIds, shapeId, allShapes, collectDescendantIds]);

    // 가시성 상태를 토글하는 함수
    const toggleVisibility = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const baseIds = e.shiftKey && selectedIds.length > 0 ? selectedIds : [shapeId];
        const expandedIds = new Set<string>();

        for (const id of baseIds) {
            expandedIds.add(id);
            const node = allShapes.find(s => s.id === id);
            if (node && node.type === 'group') {
                collectDescendantIds(id).forEach(d => expandedIds.add(d));
            }
        }
        expandedIds.forEach(id => dispatch(toggleShapeVisibility(id)));
    }, [dispatch, selectedIds, shapeId, allShapes, collectDescendantIds]);

    return { toggleLock, toggleVisibility };
}