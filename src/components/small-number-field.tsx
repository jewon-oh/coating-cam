import React, {memo, useEffect, useState} from "react";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";

export const SmallNumberField = memo(function SmallNumberField({
                                                            id,
                                                            label,
                                                            value,
                                                            step = 1,
                                                            onChange,
                                                        }: {
    id: string;
    label: string;
    value: number;
    step?: number;
    onChange: (v: number) => void;
}) {
    const [local, setLocal] = useState<number>(value);
    useEffect(() => setLocal(value), [value]);

    return (
        <div>
            <Label htmlFor={id} className="text-xs">{label}</Label>
            <Input
                id={id}
                type="number"
                value={Number.isFinite(local) ? local : 0}
                onChange={(e) => {
                    const n = Number(e.target.value);
                    setLocal(n);
                    if (!Number.isNaN(n) && Number.isFinite(n)) onChange(n);
                }}
                className="h-7 text-xs"
                step={step}
            />
        </div>
    );
});
