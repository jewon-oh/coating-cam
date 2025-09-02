
import { Circle, Group, Text } from "react-konva";

interface CoatingOrderBadgeProps {
    order?: number;
    x: number;
    y: number;
    // 부모 Group의 변환 정보를 받아옴
    parentScaleX?: number;
    parentScaleY?: number;
    parentRotation?: number;
}

export const CoatingOrderBadge = ({
                                      order,
                                      x,
                                      y,
                                      parentScaleX = 1,
                                      parentScaleY = 1,
                                      parentRotation = 0
                                  }: CoatingOrderBadgeProps) => {
    if (!order) return null;

    // 부모 변환의 역수를 계산하여 텍스트가 항상 일정한 크기로 보이도록 함
    // 0으로 나누는 것을 방지하기 위해 아주 작은 값을 사용
    const invScaleX = 1 / (parentScaleX || 0.001);
    const invScaleY = 1 / (parentScaleY || 0.001);
    const textRotation = -parentRotation;

    const badgeRadius = 9;

    return (
        <Group x={x} y={y}>
            <Circle
                radius={badgeRadius * Math.abs(invScaleX)}
                fill="#3b82f6"
                stroke="#1e40af"
                strokeWidth={2 * Math.abs(invScaleX)}
            />
            <Text
                text={order.toString()}
                fontSize={12}
                fill="white"
                fontStyle="bold"
                align="center"
                verticalAlign="middle"
                // 부모의 스케일과 회전을 상쇄하는 역변환 적용
                scaleX={invScaleX}
                scaleY={invScaleY}
                rotation={textRotation}
                // 텍스트를 그룹의 중앙에 위치시키기 위한 오프셋
                width={badgeRadius * 2}
                height={badgeRadius * 2}
                offsetX={badgeRadius}
                offsetY={badgeRadius}
            />
        </Group>
    );
};