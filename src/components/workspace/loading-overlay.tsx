import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useCanvas } from '@/contexts/canvas-context';

export const LoadingOverlay = () => {
    // ✅ Context에서 로딩 상태 가져오기
    const { loading } = useCanvas();

    return (
        <AnimatePresence>
            {loading.isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50"
                >
                    <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-lg">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">{loading.message}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};