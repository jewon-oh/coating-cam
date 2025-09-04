import React, {memo, useCallback, useState} from 'react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {
    ChevronRight,
    ChevronDown,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Users,
    Edit2,
    Trash2,
    Copy,
    Move
} from 'lucide-react';
import {cn} from '@/lib/utils';
import {CustomShapeConfig} from '@/types/custom-konva-config';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {useItemActions} from '@/hooks/object-panel/use-item-actions'; // 커스텀 훅 임포트


interface GroupItemProps {
    shape: CustomShapeConfig;
    isSelected: boolean;
    isOpen: boolean;
    memberCount?: number;
    onToggleOpen: () => void;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onPatch: (id: string, patch: Partial<CustomShapeConfig>) => void;
    onUngroup?: (groupId: string) => void;
    onDuplicate?: (groupId: string) => void;
    onDelete?: (groupId: string) => void;
    onToggleVisibility?: (groupId: string) => void;
    onToggleLock?: (groupId: string) => void;
    children?: React.ReactNode;
    depth?: number;
}

export const GroupItem = memo<GroupItemProps>(({
                                                   shape,
                                                   isSelected,
                                                   isOpen,
                                                   memberCount = 0,
                                                   onToggleOpen,
                                                   onSelect,
                                                   onPatch,
                                                   onUngroup,
                                                   onDuplicate,
                                                   onDelete,
                                                   onToggleVisibility,
                                                   onToggleLock,
                                                   depth = 0,
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
    } = useItemActions({shape, onPatch, onToggleVisibility, onToggleLock});

    const [isHovered, setIsHovered] = useState(false);

    const handleSelect = useCallback((e: React.MouseEvent) => {
        if (isEditing) return;
        onSelect(shape.id!, e);
    }, [isEditing, onSelect, shape.id]);

    const handleDuplicate = () => onDuplicate?.(shape.id!);
    const handleUngroup = () => onUngroup?.(shape.id!);
    const handleDelete = () => onDelete?.(shape.id!);


    const isVisible = shape.visible ?? true;
    const isLocked = shape.isLocked ?? false;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        "group relative flex items-center py-2 px-3 rounded-lg cursor-pointer transition-all duration-150",
                        "hover:bg-muted/50 border-l-2 border-transparent",
                        isSelected && "bg-primary/10 border-l-primary shadow-sm",
                        !isVisible && "opacity-50",
                        isLocked && "bg-muted/30"
                    )}
                    style={{marginLeft: depth * 12}}
                    onClick={handleSelect}
                    onDoubleClick={startEditing}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* 확장/축소 버튼 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-6 h-6 p-0 mr-2 hover:bg-muted"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleOpen();
                        }}
                    >
                        {isOpen ? (
                            <ChevronDown className="w-4 h-4"/>
                        ) : (
                            <ChevronRight className="w-4 h-4"/>
                        )}
                    </Button>

                    {/* 그룹 아이콘 */}
                    <div className="flex items-center mr-2">
                        <Users className="w-4 h-4 text-blue-500"/>
                    </div>

                    {/* 이름 표시/편집 */}
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <Input
                                ref={inputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleNameSubmit}
                                onKeyDown={handleKeyDown}
                                className="h-6 py-0 px-2 text-sm border-primary"
                                autoFocus
                            />
                        ) : (
                            <div className="flex items-center min-w-0">
                                <span className="text-sm font-medium truncate">
                                    {shape.name || '이름 없음'}
                                </span>
                                <Badge variant="secondary" className="ml-2 text-xs">
                                    {memberCount}
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* 컨트롤 버튼들 */}
                    <div className={cn(
                        "flex items-center gap-1 ml-2 transition-opacity",
                        !isHovered && !isSelected && "opacity-0 group-hover:opacity-100"
                    )}>
                        {/* 가시성 토글 */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0"
                            onClick={toggleVisibility}
                        >
                            {isVisible ? (
                                <Eye className="w-3 h-3"/>
                            ) : (
                                <EyeOff className="w-3 h-3 text-muted-foreground"/>
                            )}
                        </Button>

                        {/* 잠금 토글 */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-6 h-6 p-0"
                            onClick={toggleLock}
                        >
                            {isLocked ? (
                                <Lock className="w-3 h-3 text-orange-500"/>
                            ) : (
                                <Unlock className="w-3 h-3"/>
                            )}
                        </Button>
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
                    그룹 복제
                </ContextMenuItem>
                <ContextMenuSeparator/>
                <ContextMenuItem onClick={handleUngroup}>
                    <Move className="w-4 h-4 mr-2"/>
                    그룹 해제
                </ContextMenuItem>
                <ContextMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2"/>
                    삭제
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
});

GroupItem.displayName = 'GroupItemOptimized';