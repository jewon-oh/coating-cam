import React, {useMemo, useCallback, useEffect, useRef, useState, memo} from "react";
import type {AnyNodeConfig} from "@/types/custom-konva-config";
import {cn} from "@/lib/utils";
import {
    Circle as CircleIcon, Copy, Edit2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Layers,
    Lock, Move,
    RectangleHorizontal, Trash2,
    Unlock
} from "lucide-react";
import {Input} from "@/components/ui/input";
import {ellipsizeEnd} from "@/lib/ellipsize";
import {ToggleIconButton} from "@/components/object-panel/toggle-icon-button";
import {useItemActions} from "@/hooks/use-item-actions";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from "@/components/ui/context-menu";
import {useAppDispatch} from "@/hooks/redux";
import {removeShapes} from "@/store/slices/shapes-slice";

const shapeIcons = {
    rect: <RectangleHorizontal size={16} className="flex-shrink-0"/>,
    rectangle: <RectangleHorizontal size={16} className="flex-shrink-0"/>,
    circle: <CircleIcon size={16} className="flex-shrink-0"/>,
    image: <ImageIcon size={16} className="flex-shrink-0"/>,
    group: <Layers size={16} className="flex-shrink-0"/>,
} as const;

const shapeTypeNames = {
    rect: "사각형",
    rectangle: "사각형",
    circle: "원",
    image: "이미지",
    group: "그룹",
} as const;

interface ObjectItemProps {
    shape: AnyNodeConfig;
    isSelected: boolean;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onPatch: (id: string, patch: Partial<AnyNodeConfig>) => void;
}

export const ObjectItem = memo<ObjectItemProps>(({
                                                     shape,
                                                     isSelected,
                                                     onSelect,
                                                     onPatch,
                                                 }) => {
    // 공통 로직을 커스텀 훅으로 대체
    const {
        isEditing,
        editValue,
        inputRef,
        setEditValue,
        handleNameSubmit,
        handleKeyDown,
        toggleVisibility,
        toggleLock,
        startEditing,
    } = useItemActions({shape, onPatch});

    const dispatch = useAppDispatch();

    const handleItemClick = useCallback((e: React.MouseEvent) => {
        if (isEditing) return;
        onSelect(shape.id!, e);
    }, [onSelect, shape.id, isEditing]);

    const handleNameDoubleClick = useCallback((e: React.MouseEvent) => {
        startEditing(e);
    }, [startEditing]);

    const handleNameBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        handleNameSubmit();
    }, [handleNameSubmit]);

    const handleDuplicate=useCallback((e:React.MouseEvent)=>{
        dispatch(dispatch(removeShapes(shape.id)));
    });

    const handleDelete=useCallback((e:React.MouseEvent)=>{
        dispatch(dispatch(removeShapes(shape.id)));
    })

    // 상태 계산
    const isDisabled = shape.listening ?? false;
    const isHidden = shape.visible === false;

    // 크기 정보 메모이제이션
    const sizeInfo = useMemo(() => {
        if (shape.type === 'group') return null;

        if (shape.type === 'circle') {
            return `반지름 ${Math.round(shape.radius || 0)}`;
        }
        return `${Math.round(shape.width || 0)}×${Math.round(shape.height || 0)}`;
    }, [shape.type, shape.radius, shape.width, shape.height]);

    const rotationInfo = useMemo(() => {
        return shape.rotation && Math.abs(shape.rotation) > 0.1
            ? `${Math.round(shape.rotation)}°`
            : null;
    }, [shape.rotation]);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    data-shape-id={shape.id}
                    className={cn(
                        "group/item border rounded-md transition-all duration-200 hover:shadow-sm select-none",
                        "hover:border-muted-foreground/20",
                        isSelected && !isDisabled && "ring-2 ring-primary bg-primary/5 border-primary/30",
                        isHidden && "opacity-60",
                        isDisabled && "cursor-not-allowed bg-muted/20",
                    )}
                    onClick={handleItemClick}
                >
                    {/* 메인 행 */}
                    <div className="flex items-center p-3 space-x-2">
                        {/* 타입 아이콘 */}
                        <div className={cn(
                            "flex-shrink-0 p-1 rounded transition-colors",
                            isSelected && !isDisabled && "text-primary"
                        )}>
                            {shapeIcons[shape.type as keyof typeof shapeIcons]}
                        </div>

                        {/* 이름 및 정보 */}
                        <div className="flex-1 min-w-0 ">
                            <div
                                className={cn(
                                    "text-sm font-medium truncate cursor-pointer",
                                    isHidden && "line-through italic",
                                    isDisabled && "text-foreground/60"
                                )}
                                onDoubleClick={handleNameDoubleClick}
                                title={shape.name || `${shape.type} #${shape.id?.slice(0, 6)}`}
                            >
                                {isEditing ? (
                                    <Input
                                        ref={inputRef}
                                        className="h-7 text-xs -my-1"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={handleNameBlur}
                                        onKeyDown={handleKeyDown}
                                    />
                                ) : (
                                    <span>
                                {shape.name ? ellipsizeEnd(shape.name, 20) : `${shape.type} #${shape.id?.slice(0, 6)}`}
                            </span>
                                )}
                            </div>

                            {/* 타입 및 크기 정보 */}
                            <div className="text-xs text-muted-foreground flex items-center space-x-2">
                                <span>{shapeTypeNames[shape.type as keyof typeof shapeTypeNames]}</span>
                                {sizeInfo && (
                                    <>
                                        <span>•</span>
                                        <span>{sizeInfo}</span>
                                    </>
                                )}
                                {rotationInfo && (
                                    <>
                                        <span>•</span>
                                        <span>{rotationInfo}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 액션 버튼들 */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <ToggleIconButton
                                pressed={shape.isLocked}
                                onClick={toggleLock}
                                label={shape.isLocked ? "잠금 해제" : "잠그기"}
                                className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                            >
                                {shape.isLocked ? <Lock size={14}/> : <Unlock size={14}/>}
                            </ToggleIconButton>
                            <ToggleIconButton
                                pressed={shape.visible === false}
                                onClick={toggleVisibility}
                                label={shape.visible === false ? "보이기" : "숨기기"}
                                className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                            >
                                {shape.visible === false ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </ToggleIconButton>
                        </div>
                    </div>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem onClick={startEditing}>
                    <Edit2 className="w-4 h-4 mr-2"/>
                    이름 변경
                </ContextMenuItem>
                <ContextMenuItem onClick={handleDuplicate}>
                    <Copy className="w-4 h-4 mr-2"/>
                    복사
                </ContextMenuItem>
                <ContextMenuSeparator/>
                <ContextMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2"/>
                    삭제
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
});

ObjectItem.displayName = "ObjectItem";