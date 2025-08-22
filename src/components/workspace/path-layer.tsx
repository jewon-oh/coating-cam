'use client';

import React, { useState, useCallback } from 'react';
import {Group, Line, Circle, Layer} from 'react-konva';
import { PathGroup, PathSegment } from '@/types/gcode-path';

interface PathEditorLayerProps {
    pathGroups: PathGroup[];
    selectedSegmentId: string | null;
    selectedGroupId: string | null;
    selectedEndpoint: 'start' | 'end' | null;
    tool: 'select' | 'add' | 'delete' | 'split' | 'merge';
    isActive: boolean; // Path Editor 모드인지
    canvasScale: number;
    onSegmentSelect: (segmentId: string) => void;
    onGroupSelect: (groupId: string) => void;
    onEndpointDrag: (segmentId: string, endpoint: 'start' | 'end', newPos: { x: number; y: number }) => void;
    onSegmentSplit: (segmentId: string, splitPoint: { x: number; y: number }) => void;
    onAddSegment: (groupId: string, segmentData: {
        start: { x: number; y: number };
        end: { x: number; y: number };
        type: 'G0' | 'G1'
    }) => void;
}

export function PathLayer({
                                    pathGroups,
                                    selectedSegmentId,
                                    selectedGroupId,
                                    selectedEndpoint,
                                    tool,
                                    isActive,
                                    canvasScale,
                                    onSegmentSelect,
                                    onGroupSelect,
                                    onEndpointDrag,
                                    onSegmentSplit,
                                    onAddSegment
                                }: PathEditorLayerProps) {
    const [addingSegment, setAddingSegment] = useState<{
        start: { x: number; y: number };
        current: { x: number; y: number };
        groupId: string;
    } | null>(null);

    // Path Editor가 활성화되지 않은 경우 렌더링하지 않음
    if (!isActive || pathGroups.length === 0) {
        return null;
    }

    // 세그먼트 렌더링
    const renderSegment = (segment: PathSegment, groupId: string, isSelected: boolean) => {
        const isG0 = segment.type === 'G0';
        const strokeColor = isSelected ? '#3b82f6' : (isG0 ? '#ef4444' : '#10b981');
        const strokeWidth = (isSelected ? 3 : 2) / canvasScale; // 스케일에 따른 조정
        const dashEnabled = isG0;

        return (
            <Group key={segment.id}>
                {/* 세그먼트 라인 */}
                <Line
                    points={[segment.start.x, segment.start.y, segment.end.x, segment.end.y]}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    dash={dashEnabled ? [5 / canvasScale, 5 / canvasScale] : undefined}
                    onClick={() => onSegmentSelect(segment.id)}
                    onTap={() => onSegmentSelect(segment.id)}
                    onDblClick={() => {
                        if (tool === 'split') {
                            const midPoint = {
                                x: (segment.start.x + segment.end.x) / 2,
                                y: (segment.start.y + segment.end.y) / 2
                            };
                            onSegmentSplit(segment.id, midPoint);
                        }
                    }}
                    listening={isActive} // Path Editor 모드에서만 이벤트 처리
                />

                {/* 선택된 세그먼트의 컨트롤 포인트들 */}
                {isSelected && (
                    <>
                        {/* 시작점 */}
                        <Circle
                            x={segment.start.x}
                            y={segment.start.y}
                            radius={6 / canvasScale}
                            fill={selectedEndpoint === 'start' ? '#f59e0b' : '#6b7280'}
                            stroke="#ffffff"
                            strokeWidth={2 / canvasScale}
                            draggable
                            onDragMove={(e) => {
                                const newPos = { x: e.target.x(), y: e.target.y() };
                                onEndpointDrag(segment.id, 'start', newPos);
                            }}
                            onClick={() => onSegmentSelect(segment.id)}
                            listening={isActive}
                        />

                        {/* 끝점 */}
                        <Circle
                            x={segment.end.x}
                            y={segment.end.y}
                            radius={6 / canvasScale}
                            fill={selectedEndpoint === 'end' ? '#f59e0b' : '#6b7280'}
                            stroke="#ffffff"
                            strokeWidth={2 / canvasScale}
                            draggable
                            onDragMove={(e) => {
                                const newPos = { x: e.target.x(), y: e.target.y() };
                                onEndpointDrag(segment.id, 'end', newPos);
                            }}
                            onClick={() => onSegmentSelect(segment.id)}
                            listening={isActive}
                        />

                        {/* 방향 화살표 */}
                        <Line
                            points={[
                                segment.end.x - 10 / canvasScale,
                                segment.end.y - 5 / canvasScale,
                                segment.end.x,
                                segment.end.y,
                                segment.end.x - 10 / canvasScale,
                                segment.end.y + 5 / canvasScale
                            ]}
                            stroke={strokeColor}
                            strokeWidth={2 / canvasScale}
                            lineCap="round"
                            lineJoin="round"
                            listening={false}
                        />
                    </>
                )}
            </Group>
        );
    };

    // 세그먼트 추가 미리보기 핸들러
    const handleStageMouseMove = useCallback((pos: { x: number; y: number }) => {
        if (addingSegment && tool === 'add') {
            setAddingSegment(prev => prev ? { ...prev, current: pos } : null);
        }
    }, [addingSegment, tool]);

    // 세그먼트 추가 완료 핸들러
    const handleStageClick = useCallback((pos: { x: number; y: number }) => {
        if (tool === 'add' && selectedGroupId) {
            if (!addingSegment) {
                setAddingSegment({
                    start: pos,
                    current: pos,
                    groupId: selectedGroupId
                });
            } else {
                // 세그먼트 완료
                onAddSegment(addingSegment.groupId, {
                    start: addingSegment.start,
                    end: pos,
                    type: 'G1'
                });
                setAddingSegment(null);
            }
        }
    }, [tool, selectedGroupId, addingSegment, onAddSegment]);

    return (
        <Layer>
            {/* 경로 그룹들 */}
            {pathGroups.filter(group => group.visible).map(group => (
                <Group key={`path-group-${group.id}`}>
                    {group.segments.map(segment =>
                        renderSegment(
                            segment,
                            group.id,
                            segment.id === selectedSegmentId
                        )
                    )}
                </Group>
            ))}

            {/* 세그먼트 추가 미리보기 */}
            {addingSegment && tool === 'add' && (
                <Line
                    points={[
                        addingSegment.start.x,
                        addingSegment.start.y,
                        addingSegment.current.x,
                        addingSegment.current.y
                    ]}
                    stroke="#3b82f6"
                    strokeWidth={2 / canvasScale}
                    dash={[3 / canvasScale, 3 / canvasScale]}
                    listening={false}
                />
            )}
        </Layer>
    );
}