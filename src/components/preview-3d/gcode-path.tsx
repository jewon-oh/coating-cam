import {useEffect, useMemo, useRef} from "react";
import {PathPoint} from "@/components/preview-3d/path-point";

import * as THREE from 'three';

export default function GCodePath({pathData = [], scaleFactor, activeCount = 0}: {
    pathData?: PathPoint[];
    scaleFactor: number;
    activeCount?: number
}) {
    const g0Ref = useRef<THREE.LineSegments>(null!);
    const g1Ref = useRef<THREE.LineSegments>(null!);

    // 1. G0와 G1 지오메트리를 '한 번만' 미리 생성
    const {g0Geometry, g1Geometry, segmentTypes} = useMemo(() => {
        if (pathData.length === 0) {
            return {g0Geometry: new THREE.BufferGeometry(), g1Geometry: new THREE.BufferGeometry(), segmentTypes: []};
        }

        const base = [0, 2 / scaleFactor, 0];
        const transformedPoints = pathData.map(p => {
            const [x, y, z] = p.pos;
            return [y / scaleFactor, z / scaleFactor, x / scaleFactor];
        });
        const allPoints = [base, ...transformedPoints];

        const g0Positions: number[] = [];
        const g1Positions: number[] = [];
        const types: ('G0' | 'G1')[] = [];

        // 모든 선분을 순회하며 G0, G1 그룹으로 분리
        for (let i = 0; i < pathData.length; i++) {
            const p = pathData[i];
            const start = allPoints[i];
            const end = allPoints[i + 1];

            if (p.isG1) {
                g1Positions.push(...start, ...end);
                types.push('G1');
            } else {
                g0Positions.push(...start, ...end);
                types.push('G0');
            }
        }

        // BufferGeometry 생성
        const g0Geo = new THREE.BufferGeometry();
        g0Geo.setAttribute('position', new THREE.Float32BufferAttribute(g0Positions, 3));
        const g1Geo = new THREE.BufferGeometry();
        g1Geo.setAttribute('position', new THREE.Float32BufferAttribute(g1Positions, 3));

        return {g0Geometry: g0Geo, g1Geometry: g1Geo, segmentTypes: types};
    }, [pathData, scaleFactor]);

    // 2. activeCount가 바뀔 때마다 'drawRange' 값만 업데이트
    useEffect(() => {
        let g0Count = 0;
        let g1Count = 0;

        // activeCount까지의 G0, G1 선분 개수를 계산
        for (let i = 0; i < activeCount; i++) {
            if (segmentTypes[i] === 'G1') {
                g1Count++;
            } else {
                g0Count++;
            }
        }

        // GPU에 그릴 정점(vertex)의 개수를 알려줌 (선분 1개 = 정점 2개)
        if (g0Ref.current) g0Ref.current.geometry.setDrawRange(0, g0Count * 2);
        if (g1Ref.current) g1Ref.current.geometry.setDrawRange(0, g1Count * 2);

    }, [activeCount, segmentTypes]);

    return (
        <group>
            {/* G0 선분 그룹 */}
            <lineSegments ref={g0Ref} geometry={g0Geometry} frustumCulled={false}>
                <lineBasicMaterial color="#ff6600" linewidth={12}/>
            </lineSegments>

            {/* G1 선분 그룹 */}
            <lineSegments ref={g1Ref} geometry={g1Geometry} frustumCulled={false}>
                <lineBasicMaterial color="#00ff88" linewidth={15}/>
            </lineSegments>
        </group>
    );
}