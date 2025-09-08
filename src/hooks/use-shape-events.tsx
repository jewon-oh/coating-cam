// 분리된 훅들 import
import { useShapeDrawing } from './shape/use-shape-drawing';
import { useShapeSelection } from './shape/use-shape-selection';
import { useShapeEditing } from './shape/use-shape-editing';
import { useShapeMovement } from './shape/use-shape-movement';

export function useShapeEvents() {

    // 각 기능별 훅들
    const drawing = useShapeDrawing();
    const selection = useShapeSelection();
    const editing = useShapeEditing();
    const movement = useShapeMovement();


    return {
        // Drawing
        startDrawing: drawing.startDrawing,
        updateDrawing: drawing.updateDrawing,
        finishDrawing: drawing.finishDrawing,
        cancelDrawing: drawing.cancelDrawing,
        handleClickForDrawing: drawing.handleClickForDrawing,
        isDrawing: drawing.isDrawing,

        // Selection
        startDragSelection: selection.startDragSelection,
        updateDragSelection: selection.updateDragSelection,
        finishDragSelection: selection.finishDragSelection,
        cancelDragSelection: selection.cancelDragSelection,
        handleSelect: selection.handleSelect, // This will be called by useStageEvents
        isDragSelecting: selection.isDragSelecting,
        selectedShapeIds: selection.selectedShapeIds,

        // Movement
        handleDragStart: movement.handleDragStart,
        handleDragMove: movement.handleDragMove,
        handleDragEnd: movement.handleDragEnd,
        handleNudge: movement.handleNudge,
        isSnappingEnabled: movement.isSnappingEnabled,

        // Editing
        handleDelete: editing.handleDelete,
        handleCopy: editing.handleCopy,
        handlePaste: editing.handlePaste,
        handleCut: editing.handleCut,
        handleGroup: editing.handleGroup,
        handleUngroup: editing.handleUngroup,
        hasClipboardData: editing.hasClipboardData,
        handleSelectAll: selection.handleSelectAll, // Moved from editing to selection as it's more related to selection logic
    };
}
