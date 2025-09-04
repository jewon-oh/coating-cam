
// ToolHead 위치를 렌더링하는 컴포넌트 (프레임 루프 제거)
import {useMemo} from "react";

export default function ToolHead({position, scaleFactor}: { position: number[], scaleFactor: number }) {
    const cylinderHeight = 2;

    // 위치 계산 로직을 useMemo로 분리하여 불필요한 계산 방지
    const toolheadPosition: [number, number, number] = useMemo(() => {
        if (!position || position.length < 3) {
            return [0, cylinderHeight / 2, 0];
        }
        return [
            (position[1] ?? 0) / scaleFactor,
            ((position[2] ?? 0) / scaleFactor) + cylinderHeight / 2,
            (position[0] ?? 0) / scaleFactor
        ];
    }, [position, scaleFactor]);

    return (
        <mesh position={toolheadPosition}>
            <cylinderGeometry args={[0.5, 0.5, cylinderHeight]}/>
            <meshStandardMaterial color="lime"/>
        </mesh>
    );
}
