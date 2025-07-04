import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import type Konva from "konva";

// --- Type Definitions ---
export interface BaseShape {
    id: string;
    type: 'rect' | 'circle' | 'line' | 'image';
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
}
export type RectShape = Omit<Konva.RectConfig, 'id'> & BaseShape & { type: 'rect' };
export type CircleShape = Omit<Konva.CircleConfig, 'id'> & BaseShape & { type: 'circle' };
export type LineShape = Omit<Konva.LineConfig, 'id'> & BaseShape & { type: 'line' };
export type ImageShape = Omit<Konva.ImageConfig, 'id' | 'crop'> & BaseShape & {
    type: 'image';
    crop?: { x: number; y: number; width: number; height: number };
    image: HTMLImageElement; // Add image property
    src?: string; // Add src property
};
export type KonvaShape = RectShape | CircleShape | LineShape | ImageShape;
type ShapeCreationData = Omit<KonvaShape, 'id'>;

// --- Context Type ---
interface KonvaShapeContextType {
    shapes: KonvaShape[];
    selectedShapeIds: string[];
    isGroupSelected: boolean;
    selectShape: (id: string) => void;
    selectGroup: (ids: string[]) => void;
    unselectShape: (id: string) => void;
    unselectAllShapes: () => void;
    setSelectedShapeIds: (ids: string[]) => void;
    addShape: (shapeData: ShapeCreationData, callback?: (updatedShapes: KonvaShape[]) => void) => void;
    addShapeToBack: (shape: Omit<KonvaShape, 'id'>, callback: (updatedShapes: KonvaShape[]) => void) => void;
    updateShape: (id: string, updatedProps: Partial<KonvaShape>, callback?: (updatedShapes: KonvaShape[]) => void) => void;
    updateMultipleShapes: (updates: { id: string; props: Partial<KonvaShape> }[], callback?: (updatedShapes: KonvaShape[]) => void) => void;
    removeShapes: (ids: string[], callback?: (updatedShapes: KonvaShape[]) => void) => void;
    setAllShapes: (newShapes: KonvaShape[]) => void;
}

// --- Context Creation ---
export const KonvaShapeContext = createContext<KonvaShapeContextType | undefined>(undefined);

// --- Provider Component ---
export const KonvaShapeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [shapes, setShapes] = useState<KonvaShape[]>([]);
    const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
    const [isGroupSelected, setIsGroupSelected] = useState<boolean>(false);

    const selectShape = useCallback((id: string) => {
        setSelectedShapeIds([id]); // 기존 선택 유지 X, 새로운 도형만 선택
        setIsGroupSelected(false);
    }, []);

    const selectGroup = useCallback((ids: string[]) => {
        setSelectedShapeIds(ids);
        setIsGroupSelected(true);
    }, []);

    const unselectShape = useCallback((id: string) => {
        setSelectedShapeIds((prev) => prev.filter((shapeId) => shapeId !== id));
    }, []);

    const unselectAllShapes = useCallback(() => {
        setSelectedShapeIds([]);
        setIsGroupSelected(false);
    }, []);

    const addShape = useCallback((shapeData: ShapeCreationData, callback?: (updatedShapes: KonvaShape[]) => void) => {
        const newShape = { ...shapeData, id: crypto.randomUUID() } as KonvaShape;
        setShapes((prev) => {
            const newShapes = [...prev, newShape];
            if (callback) setTimeout(() => callback(newShapes), 0);
            return newShapes;
        });
    }, []);

    const addShapeToBack = useCallback((shape: Omit<KonvaShape, 'id'>, callback: (updatedShapes: KonvaShape[]) => void) => {
        const newShape = { ...shape, id: crypto.randomUUID() } as KonvaShape;
        setShapes(prev => {
            const updated = [newShape, ...prev];
            if (callback) callback(updated);
            return updated;
        });
    }, []);

    const updateShape = useCallback((id: string, updatedProps: Partial<KonvaShape>, callback?: (updatedShapes: KonvaShape[]) => void) => {
        setShapes((prev) => {
            const newShapes = prev.map((s) => s.id === id ? { ...s, ...updatedProps } as KonvaShape : s);
            if (callback) setTimeout(() => callback(newShapes), 0);
            return newShapes;
        });
    }, []);

    const updateMultipleShapes = useCallback((updates: { id: string; props: Partial<KonvaShape> }[], callback?: (updatedShapes: KonvaShape[]) => void) => {
        setShapes(prev => {
            const newShapes = prev.map(shape => {
                const update = updates.find(u => u.id === shape.id);
                return update ? { ...shape, ...update.props } as KonvaShape : shape;
            });
            if (callback) setTimeout(() => callback(newShapes), 0);
            return newShapes;
        });
    }, []);

    const removeShapes = useCallback((ids: string[], callback?: (updatedShapes: KonvaShape[]) => void) => {
        setShapes((prev) => {
            const newShapes = prev.filter((s) => !ids.includes(s.id));
            setSelectedShapeIds([]);
            setIsGroupSelected(false);
            if (callback) setTimeout(() => callback(newShapes), 0);
            return newShapes;
        });
    }, []);

    const setAllShapes = useCallback((newShapes: KonvaShape[]) => {
        setShapes(newShapes);
        setSelectedShapeIds([]);
        setIsGroupSelected(false);
    }, []);

    const contextValue: KonvaShapeContextType = {
        shapes,
        selectedShapeIds,
        isGroupSelected,
        selectShape,
        selectGroup,
        unselectShape,
        unselectAllShapes,
        setSelectedShapeIds,
        addShape,
        addShapeToBack,
        updateShape,
        updateMultipleShapes,
        removeShapes,
        setAllShapes,
    };

    return (
        <KonvaShapeContext.Provider value={contextValue}>
            {children}
        </KonvaShapeContext.Provider>
    );
};

// --- Hook ---
export const useShapeContext = () => {
    const context = useContext(KonvaShapeContext);
    if (context === undefined) {
        throw new Error('useKonvaShapes must be used within a KonvaShapeProvider');
    }
    return context;
};