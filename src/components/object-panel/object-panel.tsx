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
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export const ObjectPanel = memo(( className?: string) => {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector(selectShapes);
    const selectedShapeIds = useAppSelector(selectSelectedShapeIds);

    // 로컬 상태
    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [openItemId, setOpenItemId] = useState<string | null>(null);
    const [isDragModeEnabled, setIsDragModeEnabled] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);

    // DnD 센서 설정
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // 코팅 순서가 있는 도형들만 필터링하고 정렬
    const shapesWithCoatingOrder = useMemo(() => {
        return shapes
            .filter(shape => shape.coatingOrder && shape.coatingOrder > 0)
            .sort((a, b) => (a.coatingOrder || 0) - (b.coatingOrder || 0));
    }, [shapes]);

    // 코팅 순서에 따라 정렬된 전체 도형 목록
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
    const {flattenedTree} = useVirtualTree(
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
    }, [shapes]); // 의존성 배열에서 expandedIds 제거

    // 통계 텍스트
    const statsText = useMemo(() => {
        const total = shapes.length;
        const selected = selectedShapeIds.length;
        const coatingItems = shapesWithCoatingOrder.length;

        return `${total}개 객체${selected > 0 ? `, ${selected}개 선택` : ''}${coatingItems > 0 ? `, ${coatingItems}개 코팅` : ''}`;
    }, [shapes.length, selectedShapeIds.length, shapesWithCoatingOrder.length]);

    // DnD 이벤트 핸들러
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const {active} = event;
        setActiveId(active.id as string);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event;

        if (over && active.id !== over.id) {
            const oldIndex = shapesWithCoatingOrder.findIndex(shape => shape.id === active.id);
            const newIndex = shapesWithCoatingOrder.findIndex(shape => shape.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(shapesWithCoatingOrder, oldIndex, newIndex);

                // 새로운 순서에 따라 coatingOrder 업데이트
                newOrder.forEach((shape, index) => {
                    dispatch(updateShape({
                        id: shape.id!,
                        updatedProps: {coatingOrder: index + 1}
                    }));
                });
            }
        }

        setActiveId(null);
    }, [shapesWithCoatingOrder, dispatch]);

    // 이벤트 핸들러들
    const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
        // if (isDragModeEnabled) return; // 드래그 모드에서는 선택 비활성화

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
                        onDuplicate={() => {
                        }}
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
                    isDragEnabled={isDragModeEnabled}
                />
            </div>
        );
    }, [selectedShapeIds, shapes, handleSelect, handlePatch, handleToggleGroup, handleUngroup, handleDeleteGroup, handleToggleGroupVisibility, handleToggleGroupLock, isDragModeEnabled]);
    const renderHints = () => {
        if (shapes.length === 0) return null;

        const hints = [];

        // 선택 관련 힌트
        if (selectedShapeIds.length === 0) {
            hints.push("💡 객체를 클릭하여 선택하세요");
        } else if (selectedShapeIds.length === 1) {
            hints.push("💡 Ctrl+클릭으로 다중 선택, Shift+클릭으로 범위 선택");
        }

        // 코팅 순서 힌트
        if (shapesWithCoatingOrder.length > 1) {
            hints.push("📋 코팅 순서가 있는 객체들을 드래그하여 순서 변경 가능");
        }

        // 그룹 힌트
        const hasGroups = shapes.some(s => s.type === 'group');
        if (hasGroups) {
            hints.push("📁 그룹을 클릭하여 확장/축소");
        }

        return hints.length > 0 ? (
            <>
                {hints.map((hint, index) => (
                    <p key={index} className="text-xs text-muted-foreground mt-1">
                        {hint}
                    </p>
                ))}
            </>

        ) : null;
    };

    return (
        <Card className={cn("h-full rounded-none border-0 gap-0", className)}>
            {/* 헤더 */}
            <CardHeader className="py-0 border-b bg-muted/10">
                <CardTitle className={cn(
                    "text-lg flex items-center justify-between",
                    panelCollapsed && "hidden"
                )}>
                    <div className="flex items-center space-x-1.5">
                        <Layers className="w-3 h-3"/>
                        <span>객체</span>
                        <Badge variant="secondary" className="text-[14px] px-1 py-0.5 h-auto">
                            {shapes.length}
                        </Badge>

                    </div>
                    {/*{shapesWithCoatingOrder.length > 0 && (*/}
                    {/*    <Button*/}
                    {/*        variant={isDragModeEnabled ? "default" : "outline"}*/}
                    {/*        size="sm"*/}
                    {/*        onClick={() => setIsDragModeEnabled(!isDragModeEnabled)}*/}
                    {/*        className="h-7 text-xs"*/}
                    {/*    >*/}
                    {/*        <Move size={12} className="mr-1"/>*/}
                    {/*        {isDragModeEnabled ? "완료" : "순서변경"}*/}
                    {/*    </Button>*/}
                    {/*)}*/}
                </CardTitle>
                {renderHints()}
                {/*/!* 통계 정보 *!/*/}
                {/*<div className="text-xs text-muted-foreground">*/}
                {/*    {statsText}*/}
                {/*</div>*/}
            </CardHeader>

            {/* 트리 목록 */}
            <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={shapesWithCoatingOrder.map(shape => shape.id!)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="p-1 space-y-1">
                                {flattenedTree.map(renderTreeNode)}
                            </div>
                        </SortableContext>
                    </DndContext>
                </ScrollArea>
            </CardContent>
        </Card>
    );
});

ObjectPanel.displayName = "ObjectPanel";