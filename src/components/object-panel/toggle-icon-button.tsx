
// 작은 토글 아이콘 버튼
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {cn} from "@/lib/utils";
import React from "react";

export function ToggleIconButton({
                              pressed,
                              onClick,
                              children,
                              label,
                              className,
                          }: {
    pressed: boolean;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    label: string;
    className?: string;
}) {
    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-pressed={pressed}
                        onClick={onClick}
                        title={label}
                        className={cn(
                            "h-7 w-7 inline-flex items-center justify-center rounded-md border transition-all",
                            "hover:scale-105 active:scale-95 focus:outline-none",
                            pressed
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-background border-border text-foreground/80 hover:bg-muted/60",
                            className
                        )}
                    >
                        {children}
                    </button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
