import {motion,AnimatePresence} from "framer-motion";
import {Button} from "@/components/ui/button";

// 단축키 가이드 컴포넌트
export const ShortcutGuide = ({isVisible, onClose}: {
    isVisible: boolean;
    onClose: () => void;
}) => (
    <AnimatePresence>
        {isVisible && (
            <motion.div
                initial={{opacity: 0, scale: 0.9}}
                animate={{opacity: 1, scale: 1}}
                exit={{opacity: 0, scale: 0.9}}
                className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={onClose}
            >
                <motion.div
                    className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="text-lg font-semibold mb-4">키보드 단축키</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between">
                            <span>선택</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">V</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span>원</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">C</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span>사각형</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">R</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span>복사</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+C</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span>붙여넣기</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+V</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span>실행취소</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+Z</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span>다시실행</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+Y</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span>삭제</span>
                            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Del</kbd>
                        </div>
                    </div>
                    <Button onClick={onClose} className="w-full mt-4">
                        닫기
                    </Button>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);
