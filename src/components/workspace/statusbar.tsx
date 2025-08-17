import {motion} from "framer-motion";
import {ShapeConfig} from "konva/lib/Shape";
import {Loader2} from "lucide-react";
import {Badge} from "@/components/ui/badge";

// 상태 바 컴포넌트
export const StatusBar = ({ shapes, selectedCount, zoom, isLoading }: {
    shapes: ShapeConfig[];
    selectedCount: number;
    zoom: number;
    isLoading: boolean;
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded px-3 py-1 text-xs border shadow-sm"
    >
        <div className="flex items-center gap-3">
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            <span className="text-gray-600">
                도형: {shapes.length}
            </span>
            {selectedCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                    선택됨: {selectedCount}
                </Badge>
            )}
            <span className="text-gray-600">
                확대: {Math.round(zoom * 100)}%
            </span>
        </div>
    </motion.div>
);