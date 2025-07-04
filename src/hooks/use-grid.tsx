// src/hooks/useGrid.ts

import React, { useMemo } from 'react';
import { Layer, Line, Group, Text } from 'react-konva';

export const useGrid = (
    stage: { x: number; y: number; scale: number },
    gridSize: number,
    canvasSize: { width: number; height: number }
) => {
    return useMemo(() => {
        const lines = [];
        const labels = [];
        const majorGridSize = gridSize * 5;
        const labelGridSize = gridSize * 10; // 100mm
        const axisColor = '#8B0000';
        const majorLineColor = '#c0c0c0';
        const minorLineColor = '#e0e0e0';
        const labelColor = '#666';

        const lineStrokeWidth = 0.5 / stage.scale;
        const majorLineStrokeWidth = 1 / stage.scale;
        const axisWidth = 1.5 / stage.scale;
        const fontSize = 10 / stage.scale;

        const viewRect = {
            x: -stage.x / stage.scale,
            y: -stage.y / stage.scale,
            width: canvasSize.width / stage.scale,
            height: canvasSize.height / stage.scale,
        };

        // Vertical lines and labels
        const startX = Math.floor(viewRect.x / gridSize) * gridSize;
        const endX = viewRect.x + viewRect.width;
        for (let i = startX; i < endX; i += gridSize) {
            if (Math.abs(i) < 1e-9) continue;
            const isMajor = Math.abs(i % majorGridSize) < 1e-9;
            const isLabel = Math.abs(i % labelGridSize) < 1e-9;

            lines.push(
                <Line
                    key={`v-${i}`}
                    points={[i, viewRect.y, i, viewRect.y + viewRect.height]}
                    stroke={isMajor ? majorLineColor : minorLineColor}
                    strokeWidth={isMajor ? majorLineStrokeWidth : lineStrokeWidth}
                />
            );

            if (isLabel) {
                labels.push(
                    <Text
                        key={`label-v-${i}`}
                        x={i + 4 / stage.scale}
                        y={4 / stage.scale}
                        text={String(i)}
                        fontSize={fontSize}
                        fill={labelColor}
                    />
                );
            }
        }

        // Horizontal lines and labels
        const startY = Math.floor(viewRect.y / gridSize) * gridSize;
        const endY = viewRect.y + viewRect.height;
        for (let i = startY; i < endY; i += gridSize) {
            if (Math.abs(i) < 1e-9) continue;
            const isMajor = Math.abs(i % majorGridSize) < 1e-9;
            const isLabel = Math.abs(i % labelGridSize) < 1e-9;

            lines.push(
                <Line
                    key={`h-${i}`}
                    points={[viewRect.x, i, viewRect.x + viewRect.width, i]}
                    stroke={isMajor ? majorLineColor : minorLineColor}
                    strokeWidth={isMajor ? majorLineStrokeWidth : lineStrokeWidth}
                />
            );

            if (isLabel) {
                labels.push(
                    <Text
                        key={`label-h-${i}`}
                        x={4 / stage.scale}
                        y={i + 4 / stage.scale}
                        text={String(i)}
                        fontSize={fontSize}
                        fill={labelColor}
                    />
                );
            }
        }

        return (
            <Layer listening={false} name="grid-layer">
                <Group>
                    {lines}
                    {labels}
                    <Line
                        points={[0, viewRect.y, 0, viewRect.y + viewRect.height]}
                        stroke={axisColor}
                        strokeWidth={axisWidth}
                    />
                    <Line
                        points={[viewRect.x, 0, viewRect.x + viewRect.width, 0]}
                        stroke={axisColor}
                        strokeWidth={axisWidth}
                    />
                    <Text key="label-origin" x={4 / stage.scale} y={4 / stage.scale} text="0" fontSize={fontSize} fill={labelColor} />
                </Group>
            </Layer>
        );
    }, [gridSize, stage.x, stage.y, stage.scale, canvasSize.width, canvasSize.height]);
};