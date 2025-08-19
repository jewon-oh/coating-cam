
import React, {useMemo, useCallback, useEffect, useRef, useState, memo} from "react";
import type { AnyNodeConfig } from "@/types/custom-konva-config";
import { cn } from "@/lib/utils";
import {
    Circle as CircleIcon,
    Eye,
    EyeOff,
    GripVertical,
    Image as ImageIcon,
    Layers,
    Lock,
    RectangleHorizontal,
    Unlock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ellipsizeEnd } from "@/lib/ellipsize";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SmallNumberField } from "@/components/object-panel/small-number-field";
import { ToggleIconButton } from "@/components/object-panel/toggle-icon-button";

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

interface ObjectItemProps {
    shape: AnyNodeConfig;
    isSelected: boolean;
    isOpen: boolean;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onOpen: () => void;
    onPatch: (id: string, patch: Partial<AnyNodeConfig>) => void;
    isDragging?: boolean;
}

export const ObjectItem = memo<ObjectItemProps>(({
                                                     shape,
                                                     isSelected,
                                                     isOpen,
                                                     onSelect,
                                                     onOpen,
                                                     onPatch,
                                                     isDragging = false
                                                 }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // 편집 모드 진입 시 포커스
    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    // 이벤트 핸들러들 최적화
    const handleItemClick = useCallback((e: React.MouseEvent) => {
        if (isEditingName) return;
        onSelect(shape.id!, e);
        onOpen();
    }, [onSelect, onOpen, shape.id, isEditingName]);

    const handleToggleVisibility = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onPatch(shape.id!, { visible: !(shape.visible ?? true) });
    }, [onPatch, shape.id, shape.visible]);

    const handleToggleLock = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onPatch(shape.id!, { listening: !(shape.listening ?? false) });
    }, [onPatch, shape.id, shape.listening]);

    const handleNameDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!shape.listening) {
            setIsEditingName(true);
        }
    }, [shape.listening]);

    const handleNameSubmit = useCallback((value: string) => {
        const trimmedValue = value.trim();
        if (trimmedValue && trimmedValue !== shape.name) {
            onPatch(shape.id!, { name: trimmedValue });
        }
        setIsEditingName(false);
    }, [onPatch, shape.id, shape.name]);

    const handleNameBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        handleNameSubmit(e.target.value);
    }, [handleNameSubmit]);

    const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNameSubmit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
            setIsEditingName(false);
        }
    }, [handleNameSubmit]);


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
        <div
            data-shape-id={shape.id}
            className={cn(
                "group/item border rounded-md transition-all duration-200 hover:shadow-sm select-none",
                "hover:border-muted-foreground/20",
                isSelected && !isDisabled && "ring-2 ring-primary bg-primary/5 border-primary/30",
                isHidden && "opacity-60",
                isDisabled && "cursor-not-allowed bg-muted/20",
                isDragging && "opacity-50 shadow-lg scale-105"
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
                        {isEditingName ? (
                            <Input
                                ref={nameInputRef}
                                className="h-7 text-xs -my-1"
                                defaultValue={shape.name || ""}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={handleNameBlur}
                                onKeyDown={handleNameKeyDown}
                            />
                        ) : (
                            <span>
                                {shape.name ? ellipsizeEnd(shape.name, 12) : `${shape.type} #${shape.id?.slice(0, 6)}`}
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
                        pressed={!!shape.listening}
                        onClick={handleToggleLock}
                        label={shape.listening ? "잠금 해제" : "잠그기"}
                        className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                    >
                        {shape.listening ? <Lock size={14} /> : <Unlock size={14} />}
                    </ToggleIconButton>
                    <ToggleIconButton
                        pressed={shape.visible === false}
                        onClick={handleToggleVisibility}
                        label={shape.visible === false ? "보이기" : "숨기기"}
                        className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                    >
                        {shape.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                    </ToggleIconButton>
                </div>
            </div>
        </div>
    );
});

ObjectItem.displayName = "ObjectItem";