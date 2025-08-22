'use client';

import React, { useState, useEffect } from 'react';
import { PathSegment, PathGroup } from '@/types/gcode-path';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PathPropertiesPanelProps {
    selectedSegment: PathSegment | null;
    selectedGroup: PathGroup | null;
    onSegmentUpdate: (segmentId: string, updates: Partial<PathSegment>) => void;
    onGroupUpdate: (groupId: string, updates: Partial<PathGroup>) => void;
}

export function PathPropertiesPanel({
                                        selectedSegment,
                                        selectedGroup,
                                        onSegmentUpdate,
                                        onGroupUpdate
                                    }: PathPropertiesPanelProps) {
    const [segmentForm, setSegmentForm] = useState<Partial<PathSegment>>({});
    const [groupForm, setGroupForm] = useState<Partial<PathGroup>>({});

    // 선택된 세그먼트가 변경될 때 폼 초기화
    useEffect(() => {
        if (selectedSegment) {
            setSegmentForm(selectedSegment);
        }
    }, [selectedSegment]);

    // 선택된 그룹이 변경될 때 폼 초기화
    useEffect(() => {
        if (selectedGroup) {
            setGroupForm(selectedGroup);
        }
    }, [selectedGroup]);

    const handleSegmentSubmit = () => {
        if (selectedSegment && segmentForm) {
            onSegmentUpdate(selectedSegment.id, segmentForm);
        }
    };

    const handleGroupSubmit = () => {
        if (selectedGroup && groupForm) {
            onGroupUpdate(selectedGroup.id, groupForm);
        }
    };

    if (!selectedSegment && !selectedGroup) {
        return (
            <div className="w-80 bg-white border-l border-gray-200 flex items-center justify-center text-gray-500">
                항목을 선택하여 속성을 편집하세요
            </div>
        );
    }

    return (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">속성</h2>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* 세그먼트 속성 */}
                {selectedSegment && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">세그먼트 속성</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 타입 */}
                            <div>
                                <Label>명령어 타입</Label>
                                <Select
                                    value={segmentForm.type || 'G1'}
                                    onValueChange={(value: 'G0' | 'G1') =>
                                        setSegmentForm(prev => ({ ...prev, type: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="G0">G0 (빠른 이동)</SelectItem>
                                        <SelectItem value="G1">G1 (직선 이동/코팅)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 시작점 */}
                            <div>
                                <Label>시작점 (mm)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="X"
                                        value={segmentForm.start?.x || 0}
                                        onChange={(e) => setSegmentForm(prev => ({
                                            ...prev,
                                            start: { ...prev.start!, x: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Y"
                                        value={segmentForm.start?.y || 0}
                                        onChange={(e) => setSegmentForm(prev => ({
                                            ...prev,
                                            start: { ...prev.start!, y: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                            </div>

                            {/* 끝점 */}
                            <div>
                                <Label>끝점 (mm)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="X"
                                        value={segmentForm.end?.x || 0}
                                        onChange={(e) => setSegmentForm(prev => ({
                                            ...prev,
                                            end: { ...prev.end!, x: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Y"
                                        value={segmentForm.end?.y || 0}
                                        onChange={(e) => setSegmentForm(prev => ({
                                            ...prev,
                                            end: { ...prev.end!, y: parseFloat(e.target.value) || 0 }
                                        }))}
                                    />
                                </div>
                            </div>

                            {/* Z 높이 */}
                            <div>
                                <Label>Z 높이 (mm)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={segmentForm.z || 0}
                                    onChange={(e) => setSegmentForm(prev => ({
                                        ...prev,
                                        z: parseFloat(e.target.value) || 0
                                    }))}
                                />
                            </div>

                            {/* 이송 속도 */}
                            <div>
                                <Label>이송 속도 (mm/min)</Label>
                                <Input
                                    type="number"
                                    value={segmentForm.feedRate || 1000}
                                    onChange={(e) => setSegmentForm(prev => ({
                                        ...prev,
                                        feedRate: parseFloat(e.target.value) || 1000
                                    }))}
                                />
                            </div>

                            {/* 주석 */}
                            <div>
                                <Label>주석</Label>
                                <Textarea
                                    value={segmentForm.comment || ''}
                                    onChange={(e) => setSegmentForm(prev => ({
                                        ...prev,
                                        comment: e.target.value
                                    }))}
                                    rows={2}
                                />
                            </div>

                            <Button onClick={handleSegmentSubmit} className="w-full">
                                세그먼트 업데이트
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* 그룹 속성 */}
                {selectedGroup && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">그룹 속성</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 그룹 이름 */}
                            <div>
                                <Label>그룹 이름</Label>
                                <Input
                                    value={groupForm.name || ''}
                                    onChange={(e) => setGroupForm(prev => ({
                                        ...prev,
                                        name: e.target.value
                                    }))}
                                />
                            </div>

                            {/* 색상 */}
                            <div>
                                <Label>색상</Label>
                                <Input
                                    type="color"
                                    value={groupForm.color || '#6b7280'}
                                    onChange={(e) => setGroupForm(prev => ({
                                        ...prev,
                                        color: e.target.value
                                    }))}
                                />
                            </div>

                            {/* 실행 순서 */}
                            <div>
                                <Label>실행 순서</Label>
                                <Input
                                    type="number"
                                    value={groupForm.order || 0}
                                    onChange={(e) => setGroupForm(prev => ({
                                        ...prev,
                                        order: parseInt(e.target.value) || 0
                                    }))}
                                />
                            </div>

                            <Button onClick={handleGroupSubmit} className="w-full">
                                그룹 업데이트
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* 세그먼트 통계 */}
                {selectedGroup && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">통계</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span>총 세그먼트:</span>
                                    <span>{selectedGroup.segments.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>G0 이동:</span>
                                    <span>{selectedGroup.segments.filter(s => s.type === 'G0').length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>G1 코팅:</span>
                                    <span>{selectedGroup.segments.filter(s => s.type === 'G1').length}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}