'use client';

import React from 'react';
import { PathGroup, PathSegment } from '@/types/path';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Lock, Unlock, MoreVertical } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PathLayersPanelProps {
    pathGroups: PathGroup[];
    selectedSegmentId: string | null;
    selectedGroupId: string | null;
    onGroupSelect: (groupId: string) => void;
    onSegmentSelect: (segmentId: string) => void;
    onGroupVisibilityToggle: (groupId: string) => void;
    onGroupLockToggle: (groupId: string) => void;
    onGroupDelete: (groupId: string) => void;
}

export function PathLayersPanel({
                                    pathGroups,
                                    selectedSegmentId,
                                    selectedGroupId,
                                    onGroupSelect,
                                    onSegmentSelect,
                                    onGroupVisibilityToggle,
                                    onGroupLockToggle,
                                    onGroupDelete
                                }: PathLayersPanelProps) {
    return (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">경로 레이어</h2>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2">
                {pathGroups.map(group => (
                    <Card
                        key={group.id}
                        className={`cursor-pointer transition-colors ${
                            selectedGroupId === group.id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => onGroupSelect(group.id)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded border"
                                        style={{ backgroundColor: group.color || '#6b7280' }}
                                    />
                                    {group.name}
                                </CardTitle>

                                <div className="flex items-center gap-1">
                                    {/* 가시성 토글 */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onGroupVisibilityToggle(group.id);
                                        }}
                                    >
                                        {group.visible ?
                                            <Eye className="w-4 h-4" /> :
                                            <EyeOff className="w-4 h-4 text-gray-400" />
                                        }
                                    </Button>

                                    {/* 잠금 토글 */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onGroupLockToggle(group.id);
                                        }}
                                    >
                                        {group.locked ?
                                            <Lock className="w-4 h-4" /> :
                                            <Unlock className="w-4 h-4 text-gray-400" />
                                        }
                                    </Button>

                                    {/* 메뉴 */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem
                                                onClick={() => onGroupDelete(group.id)}
                                                className="text-red-600"
                                            >
                                                그룹 삭제
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Badge variant="outline">{group.segments.length} 세그먼트</Badge>
                                    <Badge variant="outline">
                                        순서: {group.order || 0}
                                    </Badge>
                                </div>

                                {/* 세그먼트 목록 */}
                                <div className="max-h-32 overflow-auto">
                                    {group.segments.slice(0, 5).map(segment => (
                                        <div
                                            key={segment.id}
                                            className={`text-xs p-2 rounded cursor-pointer transition-colors ${
                                                selectedSegmentId === segment.id
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'hover:bg-gray-50'
                                            }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSegmentSelect(segment.id);
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className={`font-mono ${
                                                    segment.type === 'G0' ? 'text-red-600' : 'text-green-600'
                                                }`}>
                                                    {segment.type}
                                                </span>
                                                <span className="text-gray-400">
                                                    {segment.start.x.toFixed(1)},{segment.start.y.toFixed(1)} →
                                                    {segment.end.x.toFixed(1)},{segment.end.y.toFixed(1)}
                                                </span>
                                            </div>
                                            {segment.comment && (
                                                <div className="text-gray-400 mt-1">
                                                    {segment.comment}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {group.segments.length > 5 && (
                                        <div className="text-xs text-gray-400 p-2">
                                            ... 그리고 {group.segments.length - 5}개 더
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {pathGroups.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        경로가 없습니다.
                        <br />
                        Shape에서 경로를 생성해주세요.
                    </div>
                )}
            </div>
        </div>
    );
}