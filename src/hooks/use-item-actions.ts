// hooks/useItemActions.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import type { AnyNodeConfig } from '@/types/custom-konva-config';

interface UseItemActionsProps {
    shape: AnyNodeConfig;
    onPatch: (id: string, patch: Partial<AnyNodeConfig>) => void;
    onToggleVisibility?: (id: string) => void;
    onToggleLock?: (id: string) => void;
}

export const useItemActions = ({
                                   shape,
                                   onPatch,
                                   onToggleVisibility,
                                   onToggleLock,
                               }: UseItemActionsProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(shape.name || '');
    const inputRef = useRef<HTMLInputElement>(null);

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

    const toggleVisibility = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggleVisibility) {
            onToggleVisibility(shape.id!);
        } else {
            onPatch(shape.id!, { visible: !(shape.visible ?? true) });
        }
    }, [shape.id, shape.visible, onPatch, onToggleVisibility]);

    const toggleLock = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggleLock) {
            onToggleLock(shape.id!);
        } else {
            onPatch(shape.id!, { isLocked: !(shape.isLocked ?? true) });
        }
    }, [shape.id, shape.isLocked, onPatch, onToggleLock]);

    const startEditing = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsEditing(true);
    }, []);

    return {
        isEditing,
        editValue,
        inputRef,
        setEditValue,
        handleNameSubmit,
        handleKeyDown,
        toggleVisibility,
        toggleLock,
        startEditing,
    };
};