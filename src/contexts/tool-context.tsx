import React, { createContext, useContext, useState, ReactNode } from "react";
import {Tool} from "@/types/tool";


// ✨ 2. Context의 타입 정의에 string 대신 새로 만든 Tool 타입을 사용합니다.
interface ToolContextType {
    tool: Tool;
    setTool: (tool: Tool) => void;
}

// createContext의 기본값도 새로운 타입을 따르도록 수정합니다.
export const ToolContext = createContext<ToolContextType>({
    tool: 'select',
    setTool: () => {},
});

export const ToolProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ✨ 3. useState의 타입도 string 대신 Tool 타입으로 지정합니다.
    const [tool, setTool] = useState<Tool>('select');

    return (
        <ToolContext.Provider value={{ tool, setTool }}>
            {children}
        </ToolContext.Provider>
    );
};

export const useTool = () => {
    const context = useContext(ToolContext);
    if (!context) {
        throw new Error('useTool must be used within a ToolProvider');
    }
    return context;
};