'use client';

import React, { useState, useCallback } from 'react';
import { PathGroup, PathSegment } from '@/types/gcode-path';
import { usePathEditor } from '@/hooks/use-path-layer-interactions';
import { PathCanvas } from './path-canvas';
import { PathToolbar } from './path-toolbar';
import { PathLayersPanel } from './path-layers-panel';
import { PathPropertiesPanel } from './path-properties-panel';
import { PathToGcodeConverter } from '@/lib/gcode/path-to-gcode-converter';
import { useSettings } from '@/contexts/settings-context';
import { toast } from 'sonner';

interface PathEditorProps {
    initialPaths: PathGroup[];
    onPathsChange: (paths: PathGroup[]) => void;
    workArea: { width: number; height: number };
}

export default function PathEditor({ initialPaths, onPathsChange, workArea }: PathEditorProps) {
    const { gcodeSettings } = useSettings();
    const [showProperties, setShowProperties] = useState(true);

    const {
        pathGroups,
        selectedSegmentId,
        selectedGroupId,
        selectedEndpoint,
        tool,
        handleGroupSelect,
        handleSegmentSelect,
        handleEndpointDrag,
        handleSegmentSplit,
        handleSegmentMerge,
        handleSegmentDelete,
        handleAddSegment,
        handleGroupVisibilityToggle,
        handleGroupLockToggle,
        handleUndo,
        handleRedo,
        setTool,
        canUndo,
        canRedo,
    } = usePathEditor(initialPaths, onPathsChange);

    // 선택된 세그먼트와 그룹 찾기
    const selectedSegment = selectedSegmentId
        ? pathGroups.flatMap(g => g.segments).find(s => s.id === selectedSegmentId) || null
        : null;
    const selectedGroup = selectedGroupId
        ? pathGroups.find(g => g.id === selectedGroupId) || null
        : null;

    // G-Code 내보내기
    const handleExportGCode = useCallback(() => {
        try {
            const converter = new PathToGcodeConverter(gcodeSettings);
            const gcode = converter.convertToGCode(pathGroups);

            // G-Code 다운로드
            const blob = new Blob([gcode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edited-path-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.gcode`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('G-Code가 성공적으로 내보내졌습니다.');
        } catch (error) {
            console.error('G-Code 내보내기 실패:', error);
            toast.error('G-Code 내보내기에 실패했습니다.');
        }
    }, [pathGroups, gcodeSettings]);

    // 그룹 삭제
    const handleGroupDelete = useCallback((groupId: string) => {
        onPathsChange(pathGroups.filter(g => g.id !== groupId));
        if (selectedGroupId === groupId) {
            handleGroupSelect('');
        }
        toast.success('그룹이 삭제되었습니다.');
    }, [pathGroups, selectedGroupId, onPathsChange, handleGroupSelect]);

    // 세그먼트 업데이트
    const handleSegmentUpdate = useCallback((segmentId: string, updates: Partial<PathSegment>) => {
        const newPathGroups = pathGroups.map(group => ({
            ...group,
            segments: group.segments.map(segment =>
                segment.id === segmentId ? { ...segment, ...updates } : segment
            )
        }));
        onPathsChange(newPathGroups);
        toast.success('세그먼트가 업데이트되었습니다.');
    }, [pathGroups, onPathsChange]);

    // 그룹 업데이트
    const handleGroupUpdate = useCallback((groupId: string, updates: Partial<PathGroup>) => {
        const newPathGroups = pathGroups.map(group =>
            group.id === groupId ? { ...group, ...updates } : group
        );
        onPathsChange(newPathGroups);
        toast.success('그룹이 업데이트되었습니다.');
    }, [pathGroups, onPathsChange]);

    return (
        <div className="h-full flex flex-col">
            {/* 툴바 */}
            <PathToolbar
    tool={tool}
    canUndo={canUndo}
    canRedo={canRedo}
    selectedSegmentId={selectedSegmentId}
    selectedGroupId={selectedGroupId}
    onToolChange={setTool}
    onUndo={handleUndo}
    onRedo={handleRedo}
    onExportGCode={handleExportGCode}
    onDeleteSelected={() => handleSegmentDelete()}
    />

    {/* 메인 영역 */}
    <div className="flex-1 flex">
        {/* 레이어 패널 */}
        <PathLayersPanel
    pathGroups={pathGroups}
    selectedSegmentId={selectedSegmentId}
    selectedGroupId={selectedGroupId}
    onGroupSelect={handleGroupSelect}
    onSegmentSelect={handleSegmentSelect}
    onGroupVisibilityToggle={handleGroupVisibilityToggle}
    onGroupLockToggle={handleGroupLockToggle}
    onGroupDelete={handleGroupDelete}
    />

    {/* 캔버스 */}
    <div className="flex-1">
    <PathCanvas
        pathGroups={pathGroups}
    selectedSegmentId={selectedSegmentId}
    selectedGroupId={selectedGroupId}
    selectedEndpoint={selectedEndpoint}
    tool={tool}
    workArea={workArea}
    onSegmentSelect={handleSegmentSelect}
    onGroupSelect={handleGroupSelect}
    onEndpointDrag={handleEndpointDrag}
    onSegmentSplit={handleSegmentSplit}
    onAddSegment={handleAddSegment}
    />
    </div>

    {/* 속성 패널 */}
    {showProperties && (
        <PathPropertiesPanel
            selectedSegment={selectedSegment}
        selectedGroup={selectedGroup}
        onSegmentUpdate={handleSegmentUpdate}
        onGroupUpdate={handleGroupUpdate}
        />
    )}
    </div>
    </div>
);
}