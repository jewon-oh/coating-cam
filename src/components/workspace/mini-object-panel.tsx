"use client";

import React, {useCallback, useState} from "react";
import { createSelector } from "@reduxjs/toolkit";
import {useAppDispatch, useAppSelector} from "@/hooks/redux";
import {selectShapes, updateShape} from "@/store/slices/shape-slice";
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
import {MiniObjectItem} from "./mini-object-item";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Layers, PanelLeftClose, PanelRightClose} from "lucide-react";
import {cn} from "@/lib/utils";
import {CustomShapeConfig} from "@/types/custom-konva-config";
import {Badge} from "@/components/ui/badge";
import {motion, AnimatePresence} from "framer-motion";
import {Button} from "@/components/ui/button";

// React.memo를 사용하여 MiniObjectItem을 메모이제이션합니다.
// props가 변경되지 않으면 불필요한 리렌더링을 방지합니다.
const MemoizedMiniObjectItem = React.memo(MiniObjectItem);

/**
 * createSelector를 사용하여 코팅 순서가 있는 도형 목록을 가져오는 메모이즈된 selector를 생성합니다.
 * 이 selector는 shapes 배열이 변경될 때만 재계산됩니다.
 * 결과가 이전과 동일하면 컴포넌트의 리렌더링을 방지합니다.
 */
const selectShapesWithCoatingOrder = createSelector(
    [selectShapes], // 입력 selector
    (shapes) => shapes
        .filter(shape => shape.coatingOrder && shape.coatingOrder > 0)
        .sort((a, b) => (a.coatingOrder || 0) - (b.coatingOrder || 0))
);

export const MiniObjectPanel = () => {
    const dispatch = useAppDispatch();
    // 최적화된 selector를 사용하여 필요한 데이터만 구독합니다.
    const shapesWithCoatingOrder = useAppSelector(selectShapesWithCoatingOrder);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

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

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event;

        if (over && active.id !== over.id) {
            const oldIndex = shapesWithCoatingOrder.findIndex(shape => shape.id === active.id);
            const newIndex = shapesWithCoatingOrder.findIndex(shape => shape.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(shapesWithCoatingOrder, oldIndex, newIndex);

                newOrder.forEach((shape, index) => {
                    if (shape.coatingOrder !== index + 1) {
                        dispatch(updateShape({
                            id: shape.id!,
                            updatedProps: {coatingOrder: index + 1}
                        }));
                    }
                });
            }
        }

        setActiveId(null);
    }, [shapesWithCoatingOrder, dispatch]);

    const handlePatch = useCallback((id: string, patch: Partial<CustomShapeConfig>) => {
        dispatch(updateShape({id, updatedProps: patch}));
    }, [dispatch]);

    if (shapesWithCoatingOrder.length === 0) {
        return null;
    }

    return (
        <motion.div
            animate={{width: isCollapsed ? 96 : 256}} // 축소 시 너비를 64px로 조정하여 "객체" 텍스트가 잘리지 않도록 합니다.
            transition={{duration: 0.3, ease: "easeInOut"}}
            className={cn(
                "h-auto absolute top-44 right-4 bg-white/90 backdrop-blur-sm transition-opacity duration-300 rounded-lg shadow-md border overflow-hidden",
                !isHovered && "opacity-40"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Card>
                <CardHeader
                    className="flex flex-row items-center justify-between py-1 pl-1 pr-3 border-b cursor-default h-10">
                    {/* 축소/확장 버튼 */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="h-7 w-7"
                    >
                        {isCollapsed ? <PanelLeftClose size={16}/> : <PanelRightClose size={16}/>}
                    </Button>
                    {/* 제목 영역 (확장/축소 상태에 따라 다르게 렌더링) */}
                    <CardTitle
                        className={cn("text-sm flex items-center flex-1", isCollapsed ? "justify-center" : "justify-between")}
                    >
                        {/* 확장 상태일 때의 제목 */}
                        <span className={cn("flex items-center space-x-1.5", isCollapsed && "hidden")}><Layers className="w-3 h-3"/> <span>객체</span></span>
                        
                        {/* 축소 상태일 때의 제목 (아이콘과 텍스트 가로 배열) */}
                        {isCollapsed && (
                            <div className="flex flex-row items-center justify-center space-x-1">
                                <Layers className="w-3 h-3" />
                                <span className="text-xs">객체</span>
                            </div>
                        )}

                        <Badge variant="secondary" className={cn("text-[10px] px-1 py-0.5 h-auto", isCollapsed && "hidden")}>
                            {shapesWithCoatingOrder.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>

                <AnimatePresence>
                    {!isCollapsed && (
                        <motion.div
                            initial={{opacity: 0, height: 0}}
                            animate={{opacity: 1, height: 'auto'}}
                            exit={{opacity: 0, height: 0}}
                            transition={{duration: 0.3, ease: "easeInOut"}}
                            className="overflow-hidden"
                        >
                            <CardContent className="p-0">
                                <ScrollArea className="h-72">
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
                                                {shapesWithCoatingOrder.map((shape) => (
                                                    <MemoizedMiniObjectItem
                                                        key={shape.id}
                                                        shape={shape}
                                                        onPatch={handlePatch}
                                                        isDragging={activeId === shape.id}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                </ScrollArea>
                            </CardContent>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>
        </motion.div>
    );
};
