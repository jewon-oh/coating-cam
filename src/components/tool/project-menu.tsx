import {
    Save,
    FolderOpen,
    ChevronDown,
    Download,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {Button} from "@/components/ui/button";
// 프로젝트 메뉴 컴포넌트
export const ProjectMenu = ({
                         onSave,
                         onLoad,
                     }: {
    onSave: () => void;
    onLoad: () => void;
}) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
                <FolderOpen size={16} className="mr-2"/>
                프로젝트
                <ChevronDown size={12} className="ml-2 opacity-50"/>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>프로젝트 관리</DropdownMenuLabel>
            <DropdownMenuSeparator/>
            <DropdownMenuItem onClick={onSave}>
                <Save size={16} className="mr-2"/>
                저장하기
                <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Ctrl+S</kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLoad}>
                <FolderOpen size={16} className="mr-2"/>
                불러오기
                <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Ctrl+O</kbd>
            </DropdownMenuItem>
            <DropdownMenuItem>
                <Download size={16} className="mr-2"/>
                내보내기
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);