'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    MousePointer2,
    Plus,
    Trash2,
    Split,
    Merge,
    Undo2,
    Redo2,
    Download,
    Eye,
    EyeOff,
    Lock,
    Unlock
} from 'lucide-react';

interface PathToolbarProps {
    tool: 'select' | 'add' | 'delete' | 'split' | 'merge';
    canUndo: boolean;
    canRedo: boolean;
    selectedSegmentId: string | null;
    selectedGroupId: string | null;
    onToolChange: (tool: 'select' | 'add' | 'delete' | 'split' | 'merge') => void;
    onUndo: () => void;
    onRedo: () => void;
    onExportGCode: () => void;
    onDeleteSelected: () => void;
}

export function PathToolbar({
                                tool,
                                canUndo,
                                canRedo,
                                selectedSegmentId,
                                selectedGroupId,
                                onToolChange,
                                onUndo,
                                onRedo,
                                onExportGCode,
                                onDeleteSelected
                            }: PathToolbarProps) {
    return (
        <div className="flex items-center gap-2 p-2 bg-white border-b border-gray-200">
            {/* 편집 도구들 */}
            <div className="flex items-center gap-1">
                <Button
                    variant={tool === 'select' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onToolChange('select')}
                    title="선택 도구"
                >
                    <MousePointer2 className="w-4 h-4" />
                </Button>

                <Button
                    variant={tool === 'add' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onToolChange('add')}
                    title="세그먼트 추가"
                    disabled={!selectedGroupId}
                >
                    <Plus className="w-4 h-4" />
                </Button>

                <Button
                    variant={tool === 'delete' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onToolChange('delete')}
                    title="삭제 도구"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>

                <Button
                    variant={tool === 'split' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onToolChange('split')}
                    title="세그먼트 분할"
                >
                    <Split className="w-4 h-4" />
                </Button>

                <Button
                    variant={tool === 'merge' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onToolChange('merge')}
                    title="세그먼트 병합"
                >
                    <Merge className="w-4 h-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* 실행 취소/다시 실행 */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="실행 취소"
                >
                    <Undo2 className="w-4 h-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="다시 실행"
                >
                    <Redo2 className="w-4 h-4" />
                </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* 선택된 항목 삭제 */}
            <Button
                variant="ghost"
                size="sm"
                onClick={onDeleteSelected}
                disabled={!selectedSegmentId}
                title="선택된 세그먼트 삭제"
            >
                <Trash2 className="w-4 h-4 text-red-600" />
            </Button>

            <div className="flex-1" />

            {/* G-Code 내보내기 */}
            <Button
                variant="default"
                size="sm"
                onClick={onExportGCode}
                title="G-Code 내보내기"
            >
                <Download className="w-4 h-4 mr-2" />
                G-Code 내보내기
            </Button>
        </div>
    );
}