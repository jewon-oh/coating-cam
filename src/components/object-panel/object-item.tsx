import React, {useMemo, useCallback, memo} from "react";
import type {CustomShapeConfig} from "@/types/custom-konva-config";
import {cn} from "@/lib/utils";
import {
    Circle as CircleIcon, Copy, Edit2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Layers,
    Lock,
    Slash,
    RectangleHorizontal, Trash2,
    Unlock,
    GripVertical
} from "lucide-react";
import {Input} from "@/components/ui/input";
import {ellipsizeEnd} from "@/lib/ellipsize";
import {ToggleIconButton} from "@/components/object-panel/toggle-icon-button";
import {useItemActions} from "@/hooks/object-panel/use-item-actions";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from "@/components/ui/context-menu";
import {useAppDispatch} from "@/hooks/redux";
import {removeShapes} from "@/store/slices/shape-slice";
import {Badge} from "@/components/ui/badge";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

const shapeIcons = {
    line: <Slash size={16} className="flex-shrink-0"/>,
    rectangle: <RectangleHorizontal size={16} className="flex-shrink-0"/>,
    circle: <CircleIcon size={16} className="flex-shrink-0"/>,
    image: <ImageIcon size={16} className="flex-shrink-0"/>,
    group: <Layers size={16} className="flex-shrink-0"/>,
} as const;

const shapeTypeNames = {
    line: "선",
    rectangle: "사각형",
    circle: "원",
    image: "이미지",
    group: "그룹",
} as const;

interface ObjectItemProps {
    shape: CustomShapeConfig;
    isSelected: boolean;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onPatch: (id: string, patch: Partial<CustomShapeConfig>) => void;
    isDragEnabled?: boolean;
}

export const ObjectItem = memo<ObjectItemProps>(({
                                                     shape,
                                                     isSelected,
                                                     onSelect,
                                                     onPatch,
                                                     isDragEnabled = false,
                                                 }) => {
    // DnD Kit sortable 설정
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: shape.id!,
        disabled: !isDragEnabled || shape.coatingOrder === undefined || shape.coatingOrder <= 0,
    });

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

    const handleDuplicate = useCallback((e: React.MouseEvent) => {
        // TODO: 복사 기능 구현
    }, [dispatch, shape.id]);

    const handleDelete = useCallback((e: React.MouseEvent) => {
        dispatch(removeShapes([shape.id!]));
    }, [dispatch, shape.id]);

    // 상태 계산
    const isDisabled = shape.listening ?? false;
    const isHidden = shape.visible === false;

    const coatingColorClass = useMemo(() => {
        if (shape.skipCoating) {
            return "bg-gray-500/10 border-gray-500/20";
        }
        switch (shape.coatingType) {
            case 'fill':
                return "bg-blue-500/10 border-blue-500/20";
            case 'outline':
                return "bg-orange-500/10 border-orange-500/20";
            case 'masking':
                return "bg-red-500/10 border-red-500/20";
            default:
                return "";
        }
    }, [shape.coatingType, shape.skipCoating]);

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

    // DnD 스타일 설정
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={setNodeRef}
                    style={style}
                    data-shape-id={shape.id}
                    className={cn(
                        "group/item border rounded-md transition-all duration-200 hover:shadow-sm select-none",
                        !isSelected && coatingColorClass,
                        "hover:border-muted-foreground/20",
                        isSelected && !isDisabled && "ring-2 ring-primary bg-primary/5 border-primary/30",
                        isHidden && "opacity-60",
                        isDisabled && "cursor-not-allowed bg-muted/20",
                        isDragging && "shadow-lg ring-2 ring-blue-400/50",
                    )}
                    onClick={handleItemClick}
                >
                    {/* 메인 행 */}
                    <div className="flex items-center p-3 space-x-2">
                        {/* 코팅 순서 뱃지 (맨 앞) */}
                        {shape.coatingOrder && shape.coatingOrder > 0 && (
                            <Badge variant="secondary" className="text-[11px] px-2 py-1 h-auto font-medium min-w-[24px] text-center">
                                {shape.coatingOrder}
                            </Badge>
                        )}

                        {/* DnD 핸들 (코팅 순서가 있을 때만) */}
                        {isDragEnabled && shape.coatingOrder && shape.coatingOrder > 0 && (
                            <div
                                {...attributes}
                                {...listeners}
                                className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <GripVertical size={14} />
                            </div>
                        )}

                        {/* 타입 아이콘 */}
                        <div className={cn(
                            "flex-shrink-0 p-1 rounded transition-colors",
                            isSelected && !isDisabled && "text-primary"
                        )}>
                            {shapeIcons[shape.type as keyof typeof shapeIcons]}
                        </div>

                        {/* 이름 및 정보 */}
                        <div className="flex-1 min-w-0">
                            <div
                                className={cn(
                                    "text-sm font-medium cursor-pointer",
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
                                    <span className="truncate">
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