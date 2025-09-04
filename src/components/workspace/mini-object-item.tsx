"use client";

import React, {useState} from "react";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {CustomShapeConfig} from "@/types/custom-konva-config";
import {Button} from "@/components/ui/button";
import {GripVertical, Eye, EyeOff, Lock, Unlock} from "lucide-react";
import {cn} from "@/lib/utils";
import {ellipsizeEnd} from "@/lib/ellipsize";

interface MiniObjectItemProps {
    shape: CustomShapeConfig;
    onPatch: (id: string, patch: Partial<CustomShapeConfig>) => void;
    isDragging: boolean;
}

export const MiniObjectItem = ({shape, onPatch, isDragging}: MiniObjectItemProps) => {
    const {id, name, type, visible = true, isLocked = false, coatingOrder} = shape;
    const [isHovered, setIsHovered] = useState(false);

    const {attributes, listeners, setNodeRef, transform, transition, isOver} = useSortable({id: id!});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleToggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        onPatch(id!, {visible: !visible});
    };

    const handleToggleLock = (e: React.MouseEvent) => {
        e.stopPropagation();
        onPatch(id!, {isLocked: !isLocked});
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center rounded-sm text-xs h-8 transition-colors duration-200",
                isHovered ? "bg-gray-100" : "bg-transparent",
                isOver && "ring-2 ring-blue-500",
                isLocked && "opacity-70"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <button {...attributes} {...listeners} className="p-1.5 cursor-grab active:cursor-grabbing touch-none">
                <GripVertical size={14}/>
            </button>
            <span className="w-6 flex-shrink-0 text-center font-medium text-gray-500">{coatingOrder}</span>
            <span className="flex-1 truncate pr-2">
                {ellipsizeEnd(name??"unknown",20) || type}
            </span>
            <div className="flex items-center">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleToggleVisibility}>
                    {visible ? <Eye size={14}/> : <EyeOff size={14} className="text-gray-500"/>}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleToggleLock}>
                    {isLocked ? <Lock size={14} className="text-red-500"/> : <Unlock size={14}/>}
                </Button>
            </div>
        </div>
    );
};
