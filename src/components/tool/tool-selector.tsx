"use client";

import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToolSelectorOption {
    value: string;
    label: React.ReactNode;
}

interface ToolSelectorProps {
    /** 버튼에 표시될 아이콘 */
    icon: React.ReactNode;
    /** 버튼의 주 라벨 (주로 툴팁에 사용) */
    mainLabel: string;
    /** 현재 선택된 값 */
    value: string;
    /** 값 변경 시 호출될 콜백 함수 */
    onValueChange: (value: string) => void;
    /** 드롭다운에 표시될 옵션 목록 */
    options: ToolSelectorOption[];
    /** 비활성화 여부 */
    disabled?: boolean;
    /** 선택된 값이 없을 때 표시될 플레이스홀더 */
    placeholder?: string;
    /** 추가적인 CSS 클래스 */
    className?: string;
    /** 여러 값이 혼합된 상태를 나타내는 특수 옵션 */
    mixedOption?: ToolSelectorOption;
}

/**
 * ToolButton 스타일을 가진 범용 드롭다운 선택 컴포넌트입니다.
 * 아이콘과 동적으로 변경되는 라벨을 표시하는 버튼 트리거를 가집니다.
 */
export function ToolSelector({
                                 icon,
                                 mainLabel,
                                 value,
                                 onValueChange,
                                 options,
                                 disabled,
                                 placeholder,
                                 className,
                                 mixedOption,
                             }: ToolSelectorProps) {
    // 현재 값에 해당하는 옵션을 찾아 라벨을 결정합니다.
    const selectedOption = options.find(opt => opt.value === value);
    const displayLabel = selectedOption?.label ?? (value === mixedOption?.value ? mixedOption.label : placeholder);
    const isActive = !!selectedOption;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
                <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                        "flex flex-col items-center justify-center h-14 w-auto min-w-14 p-1 space-y-1 rounded-md transition-all duration-200",
                        isActive && "bg-secondary/80 shadow-sm",
                        !disabled && "hover:bg-muted/60 hover:scale-105",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        className
                    )}
                    title={mainLabel}
                >
                    <div className="flex items-center justify-center">{icon}</div>
                    <span className="text-xs font-medium leading-none max-w-[70px] truncate">{displayLabel || mainLabel}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
                    {options.map(option => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                    {/* 'mixed' 상태일 때, 해당 옵션을 비활성화된 상태로 보여줍니다. */}
                    {mixedOption && value === mixedOption.value && (
                        <DropdownMenuRadioItem key={mixedOption.value} value={mixedOption.value} disabled>
                            {mixedOption.label}
                        </DropdownMenuRadioItem>
                    )}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}