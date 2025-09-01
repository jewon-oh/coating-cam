"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface GCodeGenerationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    progress: number;
    status: 'generating' | 'completed' | 'error';
    currentStep: string;
    error?: string;
    onViewPreview: () => void;
}

export function GCodeGenerationDialog({
                                          isOpen,
                                          onClose,
                                          progress,
                                          status,
                                          currentStep,
                                          error,
                                          onViewPreview
                                      }: GCodeGenerationDialogProps) {
    const getStatusIcon = () => {
        switch (status) {
            case 'generating':
                return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'generating':
                return 'G-Code 생성 중...';
            case 'completed':
                return 'G-Code 생성 완료!';
            case 'error':
                return 'G-Code 생성 실패';
            default:
                return '';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {getStatusIcon()}
                        {getStatusText()}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* 진행률 표시 */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">진행률</span>
                            <span className="font-mono">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>

                    {/* 현재 단계 표시 */}
                    <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">현재 작업</div>
                        <div className="text-sm font-medium">{currentStep}</div>
                    </div>

                    {/* 에러 메시지 */}
                    {status === 'error' && error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="text-sm text-red-800">
                                <strong>오류:</strong> {error}
                            </div>
                        </div>
                    )}

                    {/* 완료 시 통계 정보 (옵션) */}
                    {status === 'completed' && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                            <div className="text-sm text-green-800">
                                G-Code가 성공적으로 생성되었습니다.
                            </div>
                        </div>
                    )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex justify-end gap-2 pt-4">
                    {status === 'generating' && (
                        <Button variant="outline" disabled>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            생성 중...
                        </Button>
                    )}

                    {status === 'completed' && (
                        <>
                            <Button variant="outline" onClick={onClose}>
                                닫기
                            </Button>
                            <Button onClick={onViewPreview}>
                                미리보기
                            </Button>
                        </>
                    )}

                    {status === 'error' && (
                        <Button variant="outline" onClick={onClose}>
                            닫기
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}