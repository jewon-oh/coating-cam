import React from 'react';
import { Group, Rect, Text } from 'react-konva';

const INDICATOR_WIDTH = 130;
const INDICATOR_HEIGHT = 24;

interface ShapeSizeIndicatorProps {
  isVisible: boolean;
  position: { x: number; y: number } | null;
  sizeText: string;
  scale: { x: number; y: number };
}

export const ShapeSizeIndicator = ({
  isVisible,
  position,
  sizeText,
  scale,
}: ShapeSizeIndicatorProps) => {
  if (!isVisible || !position) {
    return null;
  }

  const invScaleX = 1 / (scale.x || 0.001);
  const invScaleY = 1 / (scale.y || 0.001);
  const width = INDICATOR_WIDTH;
  const height = INDICATOR_HEIGHT;

  // console.log("indicate")
  return (
    <Group
      x={position.x}
      y={position.y}
      offsetX={width/2}
      offsetY={-height / 2}
      scaleX={invScaleX}
      scaleY={invScaleY}
    >
      <Rect
        width={width}
        height={height}
        fill="black"
        cornerRadius={4}
        opacity={0.7}
      />
      <Text
        text={sizeText}
        fontFamily="Inter, sans-serif"
        fontSize={12}
        fill="white"
        padding={5}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
};
