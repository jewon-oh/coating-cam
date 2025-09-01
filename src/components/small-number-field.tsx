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
    value: number | string | undefined;
    step?: number;
    onChange: (v: number | undefined) => void;
}) {
    const [local, setLocal] = useState<string>(value?.toString() || '');

    useEffect(() => {
        setLocal(value?.toString() || '');
    }, [value]);

    return (
        <div>
            <Label htmlFor={id} className="text-xs">{label}</Label>
            <Input
                id={id}
                type="number"
                value={local}
                placeholder="전역 설정"
                onChange={(e) => {
                    const inputValue = e.target.value;
                    setLocal(inputValue);

                    if (inputValue === '') {
                        onChange(undefined); // 빈 값은 undefined로 처리
                    } else {
                        const n = Number(inputValue);
                        if (!Number.isNaN(n) && Number.isFinite(n)) {
                            onChange(n);
                        }
                    }
                }}
                className="h-7 text-xs"
                step={step}
            />
        </div>
    );
});