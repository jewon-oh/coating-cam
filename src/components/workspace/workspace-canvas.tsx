"use client";

import React, {useRef, useMemo} from 'react';
import {Stage, Layer, Rect} from 'react-konva';
import type Konva from 'konva';

// Redux 상태 관리
import {useAppSelector} from '@/hooks/redux';

// 커스텀 훅들
import {useTransformerHandlers} from '@/hooks/use-transformer-handlers';
import {useSettings} from '@/contexts/settings-context';
import {useCanvas} from '@/contexts/canvas-context';
import {useStageEvents} from '@/hooks/use-stage-events';

// 컴포넌트 및 타입
import CanvasGrid from '@/components/workspace/canvas-grid';
import {ShapeLayer} from '@/components/workspace/shape/shape-layer';
import {useGlobalKeyboard} from '@/hooks/use-global-keyboard';

// ===== 메인 컴포넌트 =====
export default function WorkspaceCanvas() {
    // Redux 상태에서 tool과 workspaceMode 모두 가져오기
    const {tool, workspaceMode} = useAppSelector((state) => state.tool);

    // Context에서 캔버스 상태 가져오기
    const {
        stageRef,
        canvasContainerRef,
        stage,
        isCanvasFocused,
        handleCanvasFocus,
        handleCanvasBlur,
    } = useCanvas();

    // 설정 가져오기
    const {isGridVisible, gridSize, workArea} = useSettings();

    // 참조들
    const transformerRef = useRef<Konva.Transformer>(null);

    // 변형 핸들러
    const {isTransforming} = useTransformerHandlers(transformerRef);

    // 통합된 이벤트 핸들러들 (패닝과 shape 이벤트 모두 포함)
    const {
        handleStageMouseDown,
        handleStageMouseMove,
        handleStageMouseUp,
        handleStageMouseLeave,
        handleStageDragMove,
        handleStageDragEnd,
        handleWheel,
        handleCanvasClick,
        isPanning,

        handleDelete,
        handleCopy,
        handlePaste,
        handleCut,
        handleGroup,
        handleUngroup,
        handleSelectAll,
        handleNudge,

    } = useStageEvents({
        workspaceMode
    });

    // 커서 스타일 매핑 테이블
    const cursorMapping: Record<string, string> = useMemo(
        () => ({
            "shape/select": "move",
            "shape/rectangle": "crosshair",
            "shape/circle": "crosshair",
            "path/path-select": "default",
            "path/path-node": "pointer",
            "path/path-pen": "crosshair",
            "path/path-line": "crosshair",
        }),
        []
    );

    // 최적화된 커서 스타일 계산
    const cursorStyle = useMemo(() => {
        if (isPanning) return "grabbing";
        if (isTransforming) return "move";

        const modeKey = `${workspaceMode}/${tool}`;
        return cursorMapping[modeKey] || "default";
    }, [workspaceMode, tool, isPanning, isTransforming, cursorMapping]);

    // 전역 키보드 이벤트 등록
    useGlobalKeyboard({
        onDelete: workspaceMode === 'shape' ? handleDelete : undefined,
        onCopy: workspaceMode === 'shape' ? handleCopy : undefined,
        onPaste: workspaceMode === 'shape' ? handlePaste : undefined,
        onCut: workspaceMode === 'shape' ? handleCut : undefined,
        onGroup: workspaceMode === 'shape' ? handleGroup : undefined,
        onUngroup: workspaceMode === 'shape' ? handleUngroup : undefined,
        onSelectAll: workspaceMode === 'shape' ? handleSelectAll : undefined,
        onNudge: workspaceMode === 'shape' ? handleNudge : undefined
    });


    // ===== 렌더링 =====
    return (
        <div
            ref={canvasContainerRef}
            className="absolute inset-0"
            tabIndex={0}
            onFocus={handleCanvasFocus}
            onBlur={handleCanvasBlur}
            style={{
                outline: "none",
                width: "100%",
                height: "100%",
                border: isCanvasFocused ? "2px solid rgba(59, 130, 246, 0.3)" : "2px solid transparent",
                borderRadius: "8px",
                transition: "border-color 0.2s ease",
                cursor: cursorStyle,
            }}
        >
            <Stage
                ref={stageRef}
                width={stage.width}
                height={stage.height}
                scaleX={stage.scaleX}
                scaleY={stage.scaleY}
                x={stage.x}
                y={stage.y}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onMouseLeave={handleStageMouseLeave}
                onDragMove={handleStageDragMove}
                onDragEnd={handleStageDragEnd}
                onWheel={handleWheel}
                onClick={handleCanvasClick}
            >
                <Layer>
                    {/* 캔버스 배경 */}
                    {(() => {
                        const sx = stage.scaleX || 1;
                        const sy = stage.scaleY || 1;
                        const tx = stage.x || 0;
                        const ty = stage.y || 0;

                        const vx1 = (0 - tx) / sx;
                        const vx2 = (stage.width - tx) / sx;
                        const vy1 = (0 - ty) / sy;
                        const vy2 = (stage.height - ty) / sy;

                        const bgX = Math.min(vx1, vx2);
                        const bgY = Math.min(vy1, vy2);
                        const bgW = Math.abs(vx2 - vx1);
                        const bgH = Math.abs(vy2 - vy1);

                        return (
                            <Rect
                                x={bgX}
                                y={bgY}
                                width={bgW}
                                height={bgH}
                                fill="#f0f0f0"
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                        );
                    })()}

                    {/* 작업 영역 경계 */}
                    <Rect
                        x={0}
                        y={0}
                        width={workArea.width}
                        height={workArea.height}
                        stroke="black"
                        strokeWidth={1 / Math.abs(stage.scaleX)}
                        dash={[4 / Math.abs(stage.scaleX), 2 / Math.abs(stage.scaleX)]}
                        listening={false}
                    />

                    {/* 그리드 */}
                    <CanvasGrid
                        gridSize={gridSize}
                        workArea={workArea}
                        visible={isGridVisible}
                        stageScaleX={stage.scaleX}
                        stageScaleY={stage.scaleY}
                        stageX={stage.x}
                        stageY={stage.y}
                        viewportWidth={stage.width}
                        viewportHeight={stage.height}
                    />
                </Layer>

                {/* workspaceMode에 따라 다른 레이어 렌더링 */}
                {workspaceMode === "shape" && (
                    <ShapeLayer isPanning={isPanning}/>
                )}

                {/*{workspaceMode === "path" && (*/}
                {/*    <PathLayer/>*/}
                {/*)}*/}
            </Stage>
        </div>
    );
}