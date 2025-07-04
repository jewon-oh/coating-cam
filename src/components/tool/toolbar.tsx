import { ToolButton } from "@/components/tool/tool-button";
import {
    Circle as CircleIcon,
    ImageUp,
    MousePointer2,
    RectangleHorizontal as RectangleHorizontalIcon,
    Redo,
    Undo,
    Grid as GridIcon,
    Magnet as MagnetIcon,
    FileOutput,
    Save,
    FolderOpen,
} from "lucide-react";
import React from "react";
import { useHistory } from "@/contexts/history-context";
import { useTool } from "@/contexts/tool-context";
import { useSettings } from '@/contexts/settings-context';
import { useProjectActions } from "@/hooks/use-project-actions";

interface ToolbarProps {
    onGenerateGCode: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onGenerateGCode }) => {
    const { undo, redo, canUndo, canRedo } = useHistory();
    const { tool, setTool } = useTool();
    const { isGridVisible, toggleGridVisibility, isSnappingEnabled, toggleSnapping } = useSettings();
    const { handleSaveProject, handleLoadProject } = useProjectActions();

    return (
        <div className="p-2 bg-gray-100 space-y-2">
            <ToolButton
                icon={<MousePointer2 size={24} />}
                label="선택"
                active={tool === 'select'}
                onClick={() => setTool('select')}
            />
            <ToolButton
                icon={<CircleIcon size={24} />}
                label="원"
                active={tool === 'circle'}
                onClick={() => setTool('circle')}
            />
            <ToolButton
                icon={<RectangleHorizontalIcon size={24} />}
                label="사각형"
                active={tool === 'rectangle'}
                onClick={() => setTool('rectangle')}
            />
            <ToolButton
                icon={<ImageUp size={24} />}
                label="이미지"
                active={tool === 'insert-image'}
                onClick={() => setTool('insert-image')}
            />
            <hr/>
            <ToolButton icon={<Undo size={24} />} label="취소" onClick={undo} disabled={!canUndo} />
            <ToolButton icon={<Redo size={24} />} label="다시" onClick={redo} disabled={!canRedo} />
            <hr/>
            <ToolButton
                icon={<GridIcon size={24} />}
                label="격자"
                active={isGridVisible}
                onClick={toggleGridVisibility}
            />
            <ToolButton
                icon={<MagnetIcon size={24} />}
                label="스냅"
                active={isSnappingEnabled}
                onClick={toggleSnapping}
            />
            <hr/>
            <ToolButton
                icon={<Save size={24} />}
                label="저장"
                onClick={handleSaveProject}
            />
            <ToolButton
                icon={<FolderOpen size={24} />}
                label="불러오기"
                onClick={handleLoadProject}
            />
            <hr/>
            <ToolButton
                icon={<FileOutput size={24} />}
                label="G-code 생성"
                onClick={onGenerateGCode}
            />
        </div>
    );
};