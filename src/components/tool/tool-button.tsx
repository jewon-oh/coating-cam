import React from 'react';

interface ToolButtonProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

export function ToolButton({ icon, label, active, disabled, onClick }: ToolButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-2 rounded-lg flex flex-col items-center justify-center text-sm w-16 h-16 transition-colors duration-200 shadow-sm
        ${active ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={label}
        >
            {icon}
            <span className="mt-1">{label}</span>
        </button>
    );
}
