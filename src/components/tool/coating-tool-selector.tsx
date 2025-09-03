"use client";

import React, { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateShape } from '@/store/slices/shape-slice'; // (가정) CoatingTool 타입 import
import { Paintbrush } from 'lucide-react';
import { CoatingTool } from '@/types/coating';
import { ToolSelector } from '@/components/tool/tool-selector';

/**
 * 툴바에서 사용될 코팅 도구 선택 컴포넌트입니다.
 * 사용자는 이 컴포넌트를 통해 선택된 도형에 코팅 도구를 적용하거나 해제할 수 있습니다.
 */
export function CoatingToolSelector() {
    const dispatch = useAppDispatch();
    // Redux 스토어에서 필요한 상태(도형, 선택된 도형 ID, 코팅 도구 목록)를 가져옵니다.
    const { shapes, selectedShapeIds } = useAppSelector((state) => state.shapes);


    // 현재 선택된 도형 객체 목록을 메모화합니다.
    const selectedShapes = useMemo(() =>
        shapes.filter(shape => selectedShapeIds.includes(shape.id!)),
        [shapes, selectedShapeIds]
    );

    // 선택된 도형들의 코팅 도구 ID를 기반으로 Select 컴포넌트의 현재 값을 결정합니다.
    const currentValue = useMemo(() => {
        if (selectedShapes.length === 0) {
            return ''; // 선택된 도형이 없으면 빈 값으로 설정합니다.
        }
        // 선택된 첫 번째 도형의 코팅 도구 ID를 가져옵니다. (안전한 접근을 위해 optional chaining 사용)
        const firstToolId = selectedShapes[0]?.coatingToolId;
        // 모든 선택된 도형이 동일한 코팅 도구를 사용하는지 확인합니다.
        const allHaveSameTool = selectedShapes.every(shape => shape.coatingToolId === firstToolId);

        if (allHaveSameTool) {
            return firstToolId || 'none'; // 모두 동일하면 해당 ID를, 도구가 없으면 'none'을 반환합니다.
        }
        return 'mixed'; // 서로 다른 도구를 사용하면 'mixed'를 반환합니다.
    }, [selectedShapes]);

    // 사용자가 Select 메뉴에서 다른 도구를 선택했을 때 호출되는 핸들러입니다.
    const handleValueChange = (toolId: string) => {
        // 'none'이 선택되면 null을, 그렇지 않으면 해당 도구 ID를 적용 값으로 설정합니다.
        const idToApply = toolId === 'none' ? null : toolId;

        // 선택된 모든 도형에 대해 `coatingToolId`를 업데이트하는 액션을 디스패치합니다.
        selectedShapeIds.forEach(shapeId => {
            dispatch(updateShape({
                id: shapeId,
                updatedProps: { coatingToolId: idToApply }
            }));
        });
    };

    // 선택된 도형이 없으면 Select 컴포넌트를 비활성화합니다.
    const isDisabled = selectedShapes.length === 0;

    // 드롭다운에 표시될 옵션 목록을 메모화합니다.
    const options = useMemo(() => {
        const coatingTools: CoatingTool[] = [];
        const toolOptions = coatingTools?.map((tool: CoatingTool) => ({
            value: tool.id,
            label: tool.name,
        })) || [];
        // '도구 없음' 옵션을 맨 위에 추가합니다.
        return [
            { value: 'none', label: '도구 없음' },
            ...toolOptions
        ];
    }, []);

    return (
        <ToolSelector
            icon={<Paintbrush size={16} />}
            mainLabel="코팅 도구"
            value={currentValue}
            onValueChange={handleValueChange}
            options={options}
            disabled={isDisabled}
            placeholder="도구 선택"
            mixedOption={{ value: 'mixed', label: '혼합됨' }}
        />
    );
}