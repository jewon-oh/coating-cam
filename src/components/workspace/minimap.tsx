import {motion} from "framer-motion";
import {AnyNodeConfig} from "@/types/custom-konva-config";

// 미니맵 컴포넌트
export const Minimap = ({ shapes, viewport, workArea }: {
    shapes: AnyNodeConfig[];
    viewport: { x: number; y: number; scale: number };
    workArea: { width: number; height: number };
    onViewportChange?: (x: number, y: number) => void;
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute top-4 right-4 w-32 h-24 bg-white/90 backdrop-blur-sm rounded border shadow-sm overflow-hidden"
    >
        <div className="relative w-full h-full">
            <div className="absolute inset-0 bg-gray-100">
                {/* 작업 영역 표시 */}
                <div
                    className="absolute border border-gray-400"
                    style={{
                        left: '10%',
                        top: '10%',
                        width: '80%',
                        height: '70%'
                    }}
                />

                {/* 도형들 표시 */}
                {shapes.filter(s => s.visible !== false).map(shape => {
                    const x = shape.x ?? 0;
                    const y = shape.y ?? 0;

                    return (
                        <div
                            key={shape.id}
                            className="absolute bg-blue-500 opacity-60 rounded-sm"
                            style={{
                                left: `${10 + (x / workArea.width) * 80}%`,
                                top: `${10 + (y / workArea.height) * 70}%`,
                                width: '2px',
                                height: '2px',
                            }}
                        />)
                })}

                {/* 현재 뷰포트 표시 */}
                <div
                    className="absolute border-2 border-red-500 bg-red-500/10"
                    style={{
                        left: `${Math.max(0, Math.min(90, 50 - viewport.x / 10))}%`,
                        top: `${Math.max(0, Math.min(70, 50 - viewport.y / 10))}%`,
                        width: '10%',
                        height: '15%'
                    }}
                />
            </div>
        </div>
    </motion.div>
);
