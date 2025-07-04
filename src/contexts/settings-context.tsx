// src/contexts/settings-context.tsx

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface SettingsContextType {
    isGridVisible: boolean;
    toggleGridVisibility: () => void;
    isSnappingEnabled: boolean;
    toggleSnapping: () => void;
    gridSize: number;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isGridVisible, setIsGridVisible] = useState(true);
    const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
    const gridSize = 10; // 10mm 간격의 격자

    const toggleGridVisibility = () => setIsGridVisible(prev => !prev);
    const toggleSnapping = () => setIsSnappingEnabled(prev => !prev);

    return (
        <SettingsContext.Provider value={{ isGridVisible, toggleGridVisibility, isSnappingEnabled, toggleSnapping, gridSize }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};