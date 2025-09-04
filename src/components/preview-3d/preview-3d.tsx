'use client';

import {useMemo} from 'react';
import {useSettings} from "@/contexts/settings-context";
import {Canvas} from "@react-three/fiber";
import {OrbitControls, Grid, Text, OrthographicCamera} from "@react-three/drei";
import * as THREE from 'three';
import {CustomShapeConfig} from "@/types/custom-konva-config";
import {useAppSelector} from "@/hooks/redux";
import {PathPoint} from "@/components/preview-3d/path-point";
import GCodePath from "@/components/preview-3d/gcode-path";
import ToolHead from "@/components/preview-3d/toolhead";
import Preview3DImages from "@/components/preview-3d/preview-3d-images";

interface Preview3DProps {
    toolheadPos: number[];         // [x,y,z,...]
    pathData?: PathPoint[];        // 전체 경로
    activeCount?: number;          // 현재 진행 지점(포함)까지의 포인트 개수
    imageShapes?: Extract<CustomShapeConfig, { type: 'image' }>[];
}


const Preview3D = ({
                       toolheadPos, pathData = [], activeCount = 0, imageShapes
                   }: Preview3DProps) => {
    const {workArea} = useSettings();
    const SCALE_FACTOR = 10;

    // Redux에서 직접 이미지 shapes를 가져옴
    const allShapes = useAppSelector((state) => state.shapes.shapes);
    const imageShapesFromRedux = useMemo(() =>
            allShapes.filter((shape): shape is Extract<CustomShapeConfig, { type: 'image' }> =>
                shape.type === 'image'
            ),
        [allShapes]
    );

    // props로 전달된 imageShapes가 있으면 우선 사용, 없으면 Redux에서 가져옴
    const finalImageShapes = imageShapes || imageShapesFromRedux;

    const scaledWorkArea = useMemo(() => ({
        width: workArea.width / SCALE_FACTOR,
        height: workArea.height / SCALE_FACTOR,
    }), [workArea]);

    const gridLabels = useMemo(() => {
        const labels = [];
        const labelInterval = 100;
        const fontSize = 1.5;
        const textOffset = 2;
        for (let i = 0; i <= workArea.width; i += labelInterval) {
            labels.push(
                <Text key={`x-label-${i}`} position={[-textOffset, 0, i / SCALE_FACTOR]} color="gray"
                      fontSize={fontSize} rotation={[-Math.PI / 2, 0, Math.PI / 2]} anchorX="center"
                      anchorY="middle">{`X${i}`}</Text>
            );
        }
        for (let i = 0; i <= workArea.height; i += labelInterval) {
            labels.push(
                <Text key={`y-label-${i}`} position={[i / SCALE_FACTOR, 0, -textOffset]} color="gray"
                      fontSize={fontSize} rotation={[-Math.PI / 2, 0, Math.PI / 2]} anchorX="center"
                      anchorY="middle">{`Y${i}`}</Text>
            );
        }
        return labels;
    }, [workArea]);

    const initialOrthoZoom =8;
    // 직교 카메라용 줌 레벨을 적당한 크기로 조정
    const orthographicZoom = useMemo(() => {
        if (initialOrthoZoom && initialOrthoZoom > 0) return initialOrthoZoom;
        const maxDimension = Math.max(scaledWorkArea.width, scaledWorkArea.height);
        return Math.max(3, 100 / maxDimension);
    }, [scaledWorkArea]);

    return (
        <Canvas
            style={{background: '#111111'}}
            gl={{powerPreference: 'high-performance', antialias: true}}
        >

            <OrthographicCamera
                makeDefault
                zoom={orthographicZoom}
                position={[scaledWorkArea.width / 2, 10, scaledWorkArea.height / 2]}
                near={0.1}
                far={1000}
                // 작업 영역 중앙을 바라보도록 설정
                onUpdate={(camera) => {
                    camera.up.set(0, 1, 0);
                    camera.lookAt(scaledWorkArea.width / 2, 0, scaledWorkArea.height / 2);
                    camera.updateProjectionMatrix();
                }}
            />

            <ambientLight intensity={1.2}/>
            <directionalLight
                position={[scaledWorkArea.width * 2, scaledWorkArea.height * 2, scaledWorkArea.height * 2]}
                intensity={1}/>
            <hemisphereLight groundColor={"#666"} intensity={0.8}/>

            <Grid position={[scaledWorkArea.height / 2, 0, scaledWorkArea.width / 2]}
                  args={[scaledWorkArea.height, scaledWorkArea.width]} infiniteGrid={false} sectionColor={'#555555'}
                  cellColor={'#333333'}/>
            <axesHelper args={[10]} position-y={0.01}/>
            <Text position={[11, 0.01, 0]} color="red" fontSize={1.5} rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                  anchorX="center" anchorY="middle">Y</Text>
            <Text position={[0, 11, 0]} color="green" fontSize={1.5} anchorX="center" anchorY="middle">Z</Text>
            <Text position={[0, 0.01, 11]} color="blue" fontSize={1.5} rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                  anchorX="center" anchorY="middle">X</Text>

            {gridLabels}

            <GCodePath pathData={pathData} scaleFactor={SCALE_FACTOR} activeCount={activeCount}/>
            <ToolHead position={toolheadPos} scaleFactor={SCALE_FACTOR}/>
            {/* 여러 캔버스 이미지들 표시 */}
            <Preview3DImages
                imageShapes={finalImageShapes}
                scaleFactor={SCALE_FACTOR}
            />

            <OrbitControls
                enableDamping
                enablePan
                enableZoom
                // 직교 카메라에서는 거리 제한 대신 줌 제한 사용
                minZoom={1}
                maxZoom={100}
                zoom0={20}
                mouseButtons={{
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.PAN,
                }}
                ref={(controls) => {
                    if (controls) {
                        // 수직 각도: 0 = 위에서 똑바로 내려다보기
                        controls.setPolarAngle(0);
                        // 수평 각도: Math.PI = 180도 회전하여 원점이 우측 상단으로 가도록 설정
                        controls.setAzimuthalAngle(Math.PI/2);
                        // 변경사항 적용
                        controls.update();
                    }
                }}
            />
        </Canvas>
    );
};

export default Preview3D;