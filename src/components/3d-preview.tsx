'use client';

import  { useEffect, useMemo, useRef,useState } from 'react';
import { useSettings } from "@/contexts/settings-context";
import {Canvas, extend} from "@react-three/fiber";
import { OrbitControls, Grid, Text, Line } from "@react-three/drei";
import * as THREE from 'three';
import {AnyNodeConfig} from "@/types/custom-konva-config";
import {useAppSelector} from "@/hooks/redux";



// PathPoint 타입 정의 및 export
export type PathPoint = {
    pos: [number, number, number]; // [x,y,z]
    isG1: boolean;                 // true: G1, false: G0
    line: number;                  // 원본 G-code 라인 번호
};

interface MotionBoard3DProps {
    toolheadPos: number[];         // [x,y,z,...]
    pathData?: PathPoint[];        // 전체 경로
    activeCount?: number;          // 현재 진행 지점(포함)까지의 포인트 개수
    imageShapes?: Extract<AnyNodeConfig, { type: 'image' }>[];
}


// 실제 imageShape 구조에 맞춰 다중 이미지를 렌더링하는 컴포넌트
function MultipleCanvasImages({
                                  imageShapes = [],
                                  scaleFactor,
                                  workArea
                              }: {
    imageShapes: Extract<AnyNodeConfig, { type: 'image' }>[];
    scaleFactor: number;
    workArea: { width: number; height: number };
}) {
    const [textures, setTextures] = useState<Map<string, THREE.Texture>>(new Map());
    const [loadingStates, setLoadingStates] = useState<Map<string, boolean>>(new Map());

    useEffect(() => {
        const loadTextures = async () => {
            const newTextures = new Map<string, THREE.Texture>();
            const newLoadingStates = new Map<string, boolean>();
            const loader = new THREE.TextureLoader();

            // 로딩 상태 초기화
            imageShapes.forEach(shape => {
                newLoadingStates.set(shape.id, true);
            });
            setLoadingStates(newLoadingStates);

            for (const imageShape of imageShapes) {
                if (imageShape.imageDataUrl) {
                    try {
                        console.log(`Loading texture for image: ${imageShape.name} (${imageShape.id})`);

                        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
                            loader.load(
                                imageShape.imageDataUrl!,
                                (loadedTexture) => {
                                    // 텍스처 설정 최적화
                                    loadedTexture.generateMipmaps = false;
                                    loadedTexture.minFilter = THREE.LinearFilter;
                                    loadedTexture.magFilter = THREE.LinearFilter;
                                    loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
                                    loadedTexture.wrapT = THREE.ClampToEdgeWrapping;

                                    // ✅ 텍스처를 90도 회전시켜서 원래 이미지 방향 유지
                                    loadedTexture.center.set(0.5, 0.5);
                                    loadedTexture.rotation = Math.PI / 2; // 90도 회전

                                    resolve(loadedTexture);
                                },
                                undefined,
                                reject
                            );
                        });

                        newTextures.set(imageShape.id, texture);
                        console.log(`Texture loaded successfully for: ${imageShape.name}`);
                    } catch (error) {
                        console.warn(`이미지 텍스처 로드 실패: ${imageShape.name} (${imageShape.id})`, error);
                    } finally {
                        newLoadingStates.set(imageShape.id, false);
                    }
                } else {
                    console.warn(`imageDataUrl이 없음: ${imageShape.name} (${imageShape.id})`);
                    newLoadingStates.set(imageShape.id, false);
                }
            }

            setTextures(newTextures);
            setLoadingStates(newLoadingStates);
        };

        if (imageShapes.length > 0) {
            loadTextures();
        } else {
            // imageShapes가 없으면 초기화
            setTextures(new Map());
            setLoadingStates(new Map());
        }
    }, [imageShapes]);

    if (imageShapes.length === 0) {
        return null;
    }

    return (
        <group>
            {imageShapes.map((imageShape) => {
                const texture = textures.get(imageShape.id);
                const isLoading = loadingStates.get(imageShape.id) ?? false;

                // ✅ crop된 영역의 실제 크기와 위치 계산
                const baseX = imageShape.x ?? 0;
                const baseY = imageShape.y ?? 0;
                const scaleX = imageShape.scaleX ?? 1;
                const scaleY = imageShape.scaleY ?? 1;
                const rotation = imageShape.rotation ?? 0;
                const visible = imageShape.visible ?? true;

                let effectiveX, effectiveY, effectiveWidth, effectiveHeight;

                if (imageShape.crop) {
                    // crop이 있으면 crop된 영역 사용
                    effectiveX = baseX + (imageShape.crop.x * scaleX);
                    effectiveY = baseY + (imageShape.crop.y * scaleY);
                    effectiveWidth = imageShape.crop.width * scaleX;
                    effectiveHeight = imageShape.crop.height * scaleY;
                } else {
                    // crop이 없으면 전체 이미지 사용
                    effectiveX = baseX;
                    effectiveY = baseY;
                    effectiveWidth = (imageShape.width ?? 0) * scaleX;
                    effectiveHeight = (imageShape.height ?? 0) * scaleY;
                }

                // 3D 공간에서의 실제 크기 (X,Y 바뀐 상태)
                const actualWidth = effectiveHeight / scaleFactor;
                const actualHeight = effectiveWidth / scaleFactor;

                // 3D 공간에서의 위치 (X,Y 바뀐 상태, 중심점 기준)
                const posX = (effectiveY + effectiveHeight / 2) / scaleFactor;
                const posZ = (effectiveX + effectiveWidth / 2) / scaleFactor;

                // 보이지 않는 이미지는 렌더링하지 않음
                if (!visible) {
                    return null;
                }

                if (!texture && !isLoading) {
                    return (
                        <mesh
                            key={imageShape.id}
                            position={[posX, 0.005, posZ]}
                            rotation={[-Math.PI / 2, 0, (rotation * Math.PI) / 180]}
                        >
                            <planeGeometry args={[actualWidth, actualHeight]} />
                            <meshBasicMaterial
                                color="#666666"
                                transparent
                                opacity={0.3}
                            />
                            {/* crop된 영역 표시를 위한 텍스트 */}
                            <Text
                                position={[0, 0.01, 0]}
                                fontSize={Math.min(actualWidth, actualHeight) * 0.1}
                                color="yellow"
                            >
                                {imageShape.crop ? 'CROPPED' : 'NO TEXTURE'}
                            </Text>
                        </mesh>
                    );
                }


                if (!texture) {
                    return null; // 로딩 중이면 아무것도 렌더링하지 않음
                }

                return (
                    <mesh
                        key={imageShape.id}
                        position={[posX, 0.05, posZ]}
                        rotation={[-Math.PI / 2, 0, (rotation * Math.PI) / 180]}
                        userData={{ imageShape, effectiveBounds: { x: effectiveX, y: effectiveY, width: effectiveWidth, height: effectiveHeight } }}
                    >
                        <planeGeometry args={[actualWidth, actualHeight]} />
                        <meshBasicMaterial
                            map={texture}
                            transparent
                            opacity={0.8}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                );

            })}
        </group>
    );
}

// ToolHead 위치를 렌더링하는 컴포넌트 (프레임 루프 제거)
function ToolHead({ position, scaleFactor }: { position: number[], scaleFactor: number }) {
    const cylinderHeight = 2;

    // 위치 계산 로직을 useMemo로 분리하여 불필요한 계산 방지
    const toolheadPosition = useMemo(() => {
        if (!position) return [0, cylinderHeight / 2, 0];
        return [
            (position[1] ?? 0) / scaleFactor,
            ((position[2] ?? 0) / scaleFactor) + cylinderHeight / 2,
            (position[0] ?? 0) / scaleFactor
        ] as [number, number, number];
    }, [position, scaleFactor]);

    return (
        <mesh position={toolheadPosition}>
            <cylinderGeometry args={[0.5, 0.5, cylinderHeight]} />
            <meshStandardMaterial color="lime" />
        </mesh>
    );
}


function GCodePath({ pathData = [], scaleFactor, activeCount = 0 }: { pathData?: PathPoint[]; scaleFactor: number; activeCount?: number }) {
    const g0Ref = useRef<THREE.LineSegments>(null!);
    const g1Ref = useRef<THREE.LineSegments>(null!);

    // 1. G0와 G1 지오메트리를 '한 번만' 미리 생성
    const { g0Geometry, g1Geometry, segmentTypes } = useMemo(() => {
        if (pathData.length === 0) {
            return { g0Geometry: new THREE.BufferGeometry(), g1Geometry: new THREE.BufferGeometry(), segmentTypes: [] };
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

        return { g0Geometry: g0Geo, g1Geometry: g1Geo, segmentTypes: types };
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
                <lineBasicMaterial color="#ff6600" linewidth={12} />
            </lineSegments>

            {/* G1 선분 그룹 */}
            <lineSegments ref={g1Ref} geometry={g1Geometry} frustumCulled={false}>
                <lineBasicMaterial color="#00ff88" linewidth={15} />
            </lineSegments>
        </group>
    );
}
const Preview3D = ({ toolheadPos, pathData = [], activeCount = 0,imageShapes
                   }: MotionBoard3DProps) => {
    const { workArea } = useSettings();
    const SCALE_FACTOR = 10;

    // Redux에서 직접 이미지 shapes를 가져오는 대안
    const allShapes = useAppSelector((state) => state.shapes.shapes);
    const imageShapesFromRedux = useMemo(() =>
            allShapes.filter((shape): shape is Extract<AnyNodeConfig, { type: 'image' }> =>
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
    const gridCenter = Math.max(scaledWorkArea.width, scaledWorkArea.height) / 2;

    const gridLabels = useMemo(() => {
        const labels = [];
        const labelInterval = 100;
        const fontSize = 1.5;
        const textOffset = 2;
        for (let i = 0; i <= workArea.width; i += labelInterval) {
            labels.push(
                <Text key={`x-label-${i}`} position={[-textOffset, 0, i / SCALE_FACTOR]} color="gray" fontSize={fontSize} rotation={[-Math.PI / 2, 0, Math.PI / 2]} anchorX="center" anchorY="middle">{`X${i}`}</Text>
            );
        }
        for (let i = 0; i <= workArea.height; i += labelInterval) {
            labels.push(
                <Text key={`y-label-${i}`} position={[i / SCALE_FACTOR, 0, -textOffset]} color="gray" fontSize={fontSize} rotation={[-Math.PI / 2, 0, Math.PI / 2]} anchorX="center" anchorY="middle">{`Y${i}`}</Text>
            );
        }
        return labels;
    }, [workArea]);

    return (
        <Canvas
            camera={{ position: [gridCenter, scaledWorkArea.height * 1.5, gridCenter], fov: 75 }}
            style={{ background: '#111111' }}
            gl={{ powerPreference: 'high-performance', antialias: true }}
        >
            <ambientLight intensity={1.2} />
            <directionalLight position={[scaledWorkArea.width * 2, scaledWorkArea.height * 2, scaledWorkArea.height * 2]} intensity={1} />
            <hemisphereLight groundColor={"#666"} intensity={0.8} />

            <Grid position={[scaledWorkArea.height / 2, 0, scaledWorkArea.width / 2]} args={[scaledWorkArea.height, scaledWorkArea.width]} infiniteGrid={false} sectionColor={'#555555'} cellColor={'#333333'} />
            <axesHelper args={[10]} position-y={0.01} />
            <Text position={[11, 0.01, 0]} color="red" fontSize={1.5} rotation={[-Math.PI / 2, 0, Math.PI / 2]} anchorX="center" anchorY="middle">Y</Text>
            <Text position={[0, 11, 0]} color="green" fontSize={1.5} anchorX="center" anchorY="middle">Z</Text>
            <Text position={[0, 0.01, 11]} color="blue" fontSize={1.5} rotation={[-Math.PI / 2, 0, Math.PI / 2]} anchorX="center" anchorY="middle">X</Text>

            {gridLabels}

            <GCodePath pathData={pathData} scaleFactor={SCALE_FACTOR} activeCount={activeCount} />
            <ToolHead position={toolheadPos} scaleFactor={SCALE_FACTOR} />
            {/* 여러 캔버스 이미지들 표시 */}
            <MultipleCanvasImages
                imageShapes={finalImageShapes}
                scaleFactor={SCALE_FACTOR}
                workArea={workArea}
            />

            {/* 휠 클릭(중클릭)으로 패닝: OrbitControls의 mouseButtons 매핑 */}
            <OrbitControls
                target={[scaledWorkArea.width / 2, 0, scaledWorkArea.height / 2]}
                enableDamping
                enablePan
                enableRotate
                // 기본은 MIDDLE=DOLLY, RIGHT=PAN 이므로, MIDDLE로 PAN 하도록 재매핑
                mouseButtons={{
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.PAN,
                    // RIGHT: THREE.MOUSE.DOLLY
                }}
                // 휠로 줌(도리) 유지
                // zoomSpeed, panSpeed 등 필요 시 추가 조절 가능
            />

        </Canvas>
    );
};

export default Preview3D;