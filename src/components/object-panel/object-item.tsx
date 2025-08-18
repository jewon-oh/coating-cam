import React, {memo, useCallback, useEffect, useRef, useState} from "react";
import type {AnyNodeConfig} from "@/types/custom-konva-config";
import {DraggableAttributes} from "@dnd-kit/core";
import {SyntheticListenerMap} from "@dnd-kit/core/dist/hooks/utilities";
import {cn} from "@/lib/utils";
import {
    Circle as CircleIcon,
    Eye,
    EyeOff,
    GripVertical,
    Image as ImageIcon, Layers,
    Lock,
    RectangleHorizontal,
    Unlock
} from "lucide-react";
import {Input} from "@/components/ui/input";
import {ellipsizeEnd} from "@/lib/ellipsize";
import {Collapsible, CollapsibleContent} from "@/components/ui/collapsible";
import {useShapeActions} from "@/hooks/use-shape-actions";
import {SmallNumberField} from "@/components/object-panel/small-number-field";
import {ToggleIconButton} from "@/components/object-panel/toggle-icon-button";


const shapeIcons = {
    rect: <RectangleHorizontal size={16} className="flex-shrink-0" />,
    rectangle: <RectangleHorizontal size={16} className="flex-shrink-0" />,
    circle: <CircleIcon size={16} className="flex-shrink-0" />,
    image: <ImageIcon size={16} className="flex-shrink-0" />,
    group: <Layers size={16} className="flex-shrink-0" />,
} as const;

const shapeTypeNames = {
    rect: "사각형",
    rectangle: "사각형",
    circle: "원",
    image: "이미지",
    group: "그룹",
} as const;


export const ObjectItem = memo(function ObjectItem({
                                                shape,
                                                isSelected,
                                                isOpen,
                                                onSelect,
                                                onOpen,
                                                onPatch,
                                                isDragging,
                                                dragAttributes,
                                                dragListeners,
                                            }: {
    shape: AnyNodeConfig;
    isSelected: boolean;
    isOpen: boolean;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onOpen: () => void;
    onPatch: (id: string, patch: Partial<AnyNodeConfig>) => void;
    isDragging?: boolean;
    dragAttributes?: DraggableAttributes;
    dragListeners?: SyntheticListenerMap;
}) {
    const [isEditingName, setIsEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const { toggleLock, toggleVisibility } = useShapeActions(shape.id!);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const onItemClick = useCallback((e: React.MouseEvent) => {
        onSelect(shape.id!, e);
        onOpen();
    }, [onSelect, onOpen, shape.id]);

    const rowDisabled = shape.listening;
    const rowHidden = shape.visible === false;

    return (
        <div
            data-shape-id={shape.id}
            className={cn(
                "group/item border rounded-md transition-all duration-200 hover:shadow-sm select-none",
                isSelected && !rowDisabled && "ring-2 ring-primary bg-primary/5",
                rowHidden && "opacity-60",
                rowDisabled && "cursor-not-allowed",
                isDragging && "opacity-50 shadow-lg scale-105"
            )}
            onClick={onItemClick}
        >
            <div className="flex items-center p-3 space-x-2">
                <div
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-100"
                    {...dragAttributes}
                    {...dragListeners}
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={16} />
                </div>
                <div className={cn("flex-shrink-0 p-1 rounded", isSelected && !rowDisabled && "text-primary")}>
                    {shapeIcons[shape.type as keyof typeof shapeIcons]}
                </div>
                <div className="flex-1 min-w-0">
                    <div
                        className={cn("text-sm font-medium truncate", rowHidden && "line-through italic", rowDisabled && "text-foreground/60")}
                        onDoubleClick={(e) => { e.stopPropagation(); if (!rowDisabled) setIsEditingName(true); }}
                        title={shape.name}
                    >
                        {isEditingName ? (
                            <Input
                                ref={nameInputRef}
                                className="h-7 text-xs"
                                defaultValue={shape.name || ""}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    onPatch(shape.id!, { name: val || shape.name });
                                    setIsEditingName(false);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setIsEditingName(false);
                                }}
                            />
                        ) : (
                            <>{!!shape.name && ellipsizeEnd(shape.name, 12)}</>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center space-x-2">
                        <span>{shapeTypeNames[shape.type as keyof typeof shapeTypeNames]}</span>
                        {shape.type !== 'group' && (
                            <>
                                <span>•</span>
                                <span>
                                    {shape.type === "circle"
                                        ? `반지름 ${Math.round(shape.radius || 0)}`
                                        : `${Math.round(shape.width || 0)}×${Math.round(shape.height || 0)}`}
                                </span>
                                {!!shape.rotation && Math.abs(shape.rotation) > 0.1 && (
                                    <><span>•</span><span>{Math.round(shape.rotation)}°</span></>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <ToggleIconButton pressed={!!shape.listening} onClick={toggleLock} label={shape.listening ? "잠금 해제" : "잠그기"}>
                        {shape.listening ? <Lock size={14} /> : <Unlock size={14} />}
                    </ToggleIconButton>
                    <ToggleIconButton pressed={shape.visible === false} onClick={toggleVisibility} label={shape.visible === false ? "보이기" : "숨기기"}>
                        {shape.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                    </ToggleIconButton>
                </div>
            </div>
            {shape.type !== 'group' && (
                <Collapsible open={isOpen}>
                    <CollapsibleContent className="border-t bg-muted/30" onClick={(e) => e.stopPropagation()}>
                        <div className="p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <SmallNumberField id={`${shape.id}-x`} label="X" value={shape.x || 0} onChange={(v) => onPatch(shape.id!, { x: v })} />
                                <SmallNumberField id={`${shape.id}-y`} label="Y" value={shape.y || 0} onChange={(v) => onPatch(shape.id!, { y: v })} />
                            </div>
                            {shape.type !== "circle" && (
                                <div className="grid grid-cols-2 gap-2">
                                    <SmallNumberField id={`${shape.id}-width`} label="너비" value={shape.width || 0} onChange={(v) => onPatch(shape.id!, { width: v })} />
                                    <SmallNumberField id={`${shape.id}-height`} label="높이" value={shape.height || 0} onChange={(v) => onPatch(shape.id!, { height: v })} />
                                </div>
                            )}
                            {shape.type === "circle" && (
                                <SmallNumberField id={`${shape.id}-radius`} label="반지름" value={shape.radius || 0} onChange={(v) => onPatch(shape.id!, { radius: v })} />
                            )}
                            <SmallNumberField id={`${shape.id}-rotation`} label="회전 (도)" value={shape.rotation || 0} step={1} onChange={(v) => onPatch(shape.id!, { rotation: v })} />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    );
});