"use client";

import React, {useCallback, useMemo, useState} from "react";
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
import {Layers} from "lucide-react";
import {cn} from "@/lib/utils";
import {CustomShapeConfig} from "@/types/custom-konva-config";
import {Badge} from "@/components/ui/badge";

export const MiniObjectPanel = () => {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector(selectShapes);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);

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

    const shapesWithCoatingOrder = useMemo(() => {
        return shapes
            .filter(shape => shape.coatingOrder && shape.coatingOrder > 0)
            .sort((a, b) => (a.coatingOrder || 0) - (b.coatingOrder || 0));
    }, [shapes]);

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
        <Card
            className={cn(
                "h-80 absolute top-44 right-4 w-64  bg-white/90 backdrop-blur-sm transition-opacity duration-300",
                !isHovered && "opacity-40"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <CardHeader className="py-0 px-3  border-b cursor-default">
                <CardTitle className="text-sm flex items-center space-x-1.5">
                    <Layers className="w-3 h-3"/>
                    <span>객체</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0.5 h-auto">
                        {shapes.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden ">
                <ScrollArea className="h-50">
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
                                    <MiniObjectItem
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
        </Card>
    );
};
