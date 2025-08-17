import React from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolButtonProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    className?: string;
}

export function ToolButton({ icon, label, active, disabled, onClick, className }: ToolButtonProps) {
    return (
        <Button
            variant={active ? 'secondary' : 'ghost'}
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center h-14 w-14 p-1 space-y-1 rounded-md transition-all duration-200",
                active && "bg-secondary/80 shadow-sm",
                !disabled && "hover:bg-muted/60 hover:scale-105",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
            title={label}
        >
            <div className="flex items-center justify-center">
                {icon}
            </div>
            <span className="text-xs font-medium leading-none">{label}</span>
        </Button>
    );
}