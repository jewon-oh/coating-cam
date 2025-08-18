import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ChevronRight,
    ChevronDown,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Users,
    MoreHorizontal,
    Edit2,
    Trash2,
    Copy,
    Move
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnyNodeConfig } from '@/types/custom-konva-config';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GroupItemProps {
    shape: AnyNodeConfig;
    isSelected: boolean;
    isOpen: boolean;
    memberCount?: number;
    onToggleOpen: () => void;
    onSelect: (id: string, e: React.MouseEvent) => void;
    onPatch: (id: string, patch: Partial<AnyNodeConfig>) => void;
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
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(shape.name || '');
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // 이름 편집 처리
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleNameSubmit = useCallback(() => {
        if (editValue.trim() && editValue !== shape.name) {
            onPatch(shape.id!, { name: editValue.trim() });
        }
        setIsEditing(false);
    }, [editValue, shape.name, shape.id, onPatch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNameSubmit();
        } else if (e.key === 'Escape') {
            setEditValue(shape.name || '');
            setIsEditing(false);
        }
    }, [handleNameSubmit, shape.name]);

    // 가시성 토글
    const toggleVisibility = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggleVisibility) {
            onToggleVisibility(shape.id!);
        } else {
            onPatch(shape.id!, { visible: !(shape.visible ?? true) });
        }
    }, [shape.id, shape.visible, onPatch, onToggleVisibility]);

    // 잠금 토글
    const toggleLock = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggleLock) {
            onToggleLock(shape.id!);
        } else {
            onPatch(shape.id!, { listening: !(shape.listening ?? false) });
        }
    }, [shape.id, shape.listening, onPatch, onToggleLock]);

    // 선택 처리
    const handleSelect = useCallback((e: React.MouseEvent) => {
        if (isEditing) return;
        onSelect(shape.id!, e);
    }, [isEditing, onSelect, shape.id]);

    // 더블클릭으로 이름 편집
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    }, []);

    const isVisible = shape.visible ?? true;
    const isLocked = shape.listening ?? false;

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
                    style={{ marginLeft: depth * 12 }}
                    onClick={handleSelect}
                    onDoubleClick={handleDoubleClick}
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
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </Button>

                    {/* 그룹 아이콘 */}
                    <div className="flex items-center mr-2">
                        <Users className="w-4 h-4 text-blue-500" />
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
                                <Eye className="w-3 h-3" />
                            ) : (
                                <EyeOff className="w-3 h-3 text-muted-foreground" />
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
                                <Lock className="w-3 h-3 text-orange-500" />
                            ) : (
                                <Unlock className="w-3 h-3" />
                            )}
                        </Button>

                        {/* 더보기 메뉴 */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-6 h-6 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    이름 변경
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate?.(shape.id!)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    복제
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onUngroup?.(shape.id!)}>
                                    <Move className="w-4 h-4 mr-2" />
                                    그룹 해제
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => onDelete?.(shape.id!)}
                                    className="text-red-600"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    삭제
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    이름 변경
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onDuplicate?.(shape.id!)}>
                    <Copy className="w-4 h-4 mr-2" />
                    그룹 복제
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onUngroup?.(shape.id!)}>
                    <Move className="w-4 h-4 mr-2" />
                    그룹 해제
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
});

GroupItem.displayName = 'GroupItemOptimized';