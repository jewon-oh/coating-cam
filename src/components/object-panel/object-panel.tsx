"use client";

import React, {
    useState,
    useEffect,
    useMemo,
    useCallback,
    memo
} from "react";
import {useAppDispatch, useAppSelector} from "@/hooks/redux";
import {
    selectShapes,
    selectSelectedShapeIds,
    updateShape,
    selectShape,
    selectMultipleShapes,
    unselectAllShapes,
    ungroupShapes,
    removeShapes,
    toggleGroupVisibility,
    toggleGroupLock,
} from "@/store/slices/shape-slice";
import {setPresent} from "@/store/slices/shape-history-slice";
import type {CustomShapeConfig} from "@/types/custom-konva-config";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Badge} from "@/components/ui/badge";
import {
    Layers,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {useVirtualTree} from "@/hooks/object-panel/use-virtual-tree";
import {GroupItem} from "@/components/object-panel/group-item";
import {ObjectItem} from "@/components/object-panel/object-item";
import debounce from "lodash/debounce";

export const ObjectPanel = memo(() => {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector(selectShapes);
    const selectedShapeIds = useAppSelector(selectSelectedShapeIds);

    // 로컬 상태
    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [openItemId, setOpenItemId] = useState<string | null>(null);

    // 코팅 순서에 따라 정렬된 도형 목록
    const sortedShapes = useMemo(() => {
        const shapesCopy = [...shapes];
        shapesCopy.sort((a, b) => {
            const orderA = a.coatingOrder ?? 0;
            const orderB = b.coatingOrder ?? 0;

            const aHasOrder = orderA > 0;
            const bHasOrder = orderB > 0;

            if (aHasOrder && bHasOrder) {
                return orderA - orderB; // 코팅 순서 오름차순 정렬
            }
            if (aHasOrder) {
                return -1; // a가 앞으로
            }
            if (bHasOrder) {
                return 1; // b가 앞으로
            }
            return 0; // 순서 없는 아이템들은 기존 순서 유지
        });
        return shapesCopy;
    }, [shapes]);

    // useVirtualTree를 사용한 트리 구조 생성
    const { flattenedTree } = useVirtualTree(
        sortedShapes, // 정렬된 배열 사용
        expandedIds
    );

    // 새로 생성된 그룹 자동 확장 (수정된 부분)
    useEffect(() => {
        const currentGroupIds = new Set(shapes.filter(s => s.type === 'group').map(s => s.id!));
        const newGroupIds = [...currentGroupIds].filter(id => !expandedIds.has(id));

        if (newGroupIds.length > 0) {
            setExpandedIds(prev => new Set([...prev, ...newGroupIds]));
        }
    }, [ shapes]); // 의존성 배열에서 expandedIds 제거

    // 통계 텍스트
    const statsText = useMemo(() => {
        const total = shapes.length;
        const selected = selectedShapeIds.length;

        return `${total}개 객체${selected > 0 ? `, ${selected}개 선택` : ''}`;
    }, [shapes.length, selectedShapeIds.length]);

    // 이벤트 핸들러들
    const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;

        if (shape.type === 'group') {
            // 그룹 선택 로직
            const collectDescendantShapeIds = (parentId: string): string[] => {
                const descendants: string[] = [];
                const children = shapes.filter(s => s.parentId === parentId);

                for (const child of children) {
                    if (child.type === 'group') {
                        descendants.push(...collectDescendantShapeIds(child.id!));
                    } else if (child.visible !== false && !child.listening) {
                        descendants.push(child.id!);
                    }
                }

                return descendants;
            };

            const memberIds = collectDescendantShapeIds(id);

            if (e.metaKey || e.ctrlKey) {
                dispatch(selectMultipleShapes(Array.from(new Set([...selectedShapeIds, ...memberIds]))));
            } else {
                dispatch(selectMultipleShapes(memberIds));
            }
            return;
        }

        // 개별 객체 선택 로직
        if (shape.listening) return;

        if (e.shiftKey && selectedShapeIds.length > 0) {
            // 범위 선택 로직 (트리 구조에서)
            const lastSelectedId = selectedShapeIds[selectedShapeIds.length - 1];
            const lastIndex = flattenedTree.findIndex(node => node.id === lastSelectedId);
            const currentIndex = flattenedTree.findIndex(node => node.id === id);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const rangeIds = flattenedTree
                    .slice(start, end + 1)
                    .map(node => node.id)
                    .filter(id => {
                        const shape = shapes.find(s => s.id === id);
                        return shape && shape.type !== 'group' && !shape.listening;
                    });
                dispatch(selectMultipleShapes(rangeIds));
            }
        } else if (e.metaKey || e.ctrlKey) {
            // 다중 선택
            const newSelection = selectedShapeIds.includes(id)
                ? selectedShapeIds.filter(sid => sid !== id)
                : [...selectedShapeIds, id];

            if (newSelection.length > 0) {
                dispatch(selectMultipleShapes(newSelection));
            } else {
                dispatch(unselectAllShapes());
            }
        } else {
            // 단일 선택
            dispatch(selectShape(id));
        }

        setOpenItemId(id);
    }, [dispatch, shapes, selectedShapeIds, flattenedTree]);

    // 그룹 토글
    const handleToggleGroup = useCallback((groupId: string) => {
        setExpandedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    }, []);

    // 속성 패치 (디바운스)
    const debouncedUpdate = useMemo(
        () => debounce((id: string, patch: Partial<CustomShapeConfig>) => {
            dispatch(updateShape({id, updatedProps: patch}));
        }, 50),
        [dispatch]
    );

    useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

    const handlePatch = useCallback((id: string, patch: Partial<CustomShapeConfig>) => {
        debouncedUpdate(id, patch);
    }, [debouncedUpdate]);

    // 그룹 관련 액션들
    const handleUngroup = useCallback((groupId: string) => {
        dispatch(ungroupShapes(groupId));
        dispatch(setPresent(
            shapes
                .filter(s => s.id !== groupId)
                .map(s => s.parentId === groupId ? {...s, parentId: null} : s)
        ));
    }, [dispatch, shapes]);

    const handleDeleteGroup = useCallback((groupId: string) => {
        const membersToDelete = shapes.filter(s => s.parentId === groupId).map(s => s.id!);
        const allIdsToDelete = [groupId, ...membersToDelete];
        dispatch(removeShapes(allIdsToDelete));
        dispatch(setPresent(shapes.filter(s => !allIdsToDelete.includes(s.id!))));
    }, [dispatch, shapes]);

    const handleToggleGroupVisibility = useCallback((groupId: string) => {
        dispatch(toggleGroupVisibility(groupId));
    }, [dispatch]);

    const handleToggleGroupLock = useCallback((groupId: string) => {
        dispatch(toggleGroupLock(groupId));
    }, [dispatch]);

    // 트리 노드 렌더링
    const renderTreeNode = useCallback((node: ReturnType<typeof useVirtualTree>['flattenedTree'][0]) => {
        const {shape, depth, isExpanded} = node;
        const isSelected = selectedShapeIds.includes(shape.id!);

        if (shape.type === 'group') {
            return (
                <div key={shape.id} style={{paddingLeft: depth * 16}}>
                    <GroupItem
                        shape={shape}
                        isSelected={isSelected}
                        isOpen={isExpanded}
                        memberCount={shapes.filter(s => s.parentId === shape.id).length}
                        onToggleOpen={() => handleToggleGroup(shape.id!)}
                        onSelect={handleSelect}
                        onPatch={handlePatch}
                        onUngroup={handleUngroup}
                        onDuplicate={() => {}}
                        onDelete={handleDeleteGroup}
                        onToggleVisibility={handleToggleGroupVisibility}
                        onToggleLock={handleToggleGroupLock}
                        depth={depth}
                    />
                </div>
            );
        }

        return (
            <div key={shape.id} style={{paddingLeft: depth * 16}}>
                <ObjectItem
                    shape={shape}
                    isSelected={isSelected}
                    onSelect={handleSelect}
                    onPatch={handlePatch}
                />
            </div>
        );
    }, [selectedShapeIds, shapes, handleSelect, handlePatch, handleToggleGroup, handleUngroup, handleDeleteGroup, handleToggleGroupVisibility, handleToggleGroupLock]);

    return (
        <Card className="h-full w-full rounded-none flex flex-col transition-all duration-200 border-0 gap-0">
            {/* 헤더 */}
            <CardHeader className="px-2 pb-0border-b bg-muted/10">
                <CardTitle className={cn(
                    "text-lg flex items-center space-x-1.5",
                    panelCollapsed && "hidden"
                )}>
                    <Layers className="w-3 h-3"/>
                    <span>객체</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0.5 h-auto">
                        {shapes.length}
                    </Badge>
                </CardTitle>
            </CardHeader>

            {/* 트리 목록 */}
            <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="px-2 pt-1 pb-12 space-y-0.5">
                        {flattenedTree.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Layers className="w-8 h-8 mx-auto mb-2 opacity-30"/>
                                <p className="text-xs">객체가 없습니다</p>
                            </div>
                        ) : (
                            flattenedTree.map(renderTreeNode)
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
});

ObjectPanel.displayName = "ObjectPanel";

export default ObjectPanel;