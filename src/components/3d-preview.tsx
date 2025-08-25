'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useSettings} from "@/contexts/settings-context";
import {Canvas} from "@react-three/fiber";
import {OrbitControls, Grid, Text, OrthographicCamera} from "@react-three/drei";
import * as THREE from 'three';
import {CustomShapeConfig} from "@/types/custom-konva-config";
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
    imageShapes?: Extract<CustomShapeConfig, { type: 'image' }>[];
    orthographicView?:boolean;
}

/**
 * 이미지 데이터 URL과 crop 정보를 받아, 잘라낸 새 이미지 데이터 URL을 반환합니다.
 * @param dataUrl 원본 이미지의 데이터 URL
 * @param crop {x, y, width, height} 크롭 정보
 * @returns Promise<string> - 잘라낸 이미지의 데이터 URL
 */
function cropImageData(dataUrl: string, crop: { x: number, y: number, width: number, height: number }): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            // crop 크기에 맞는 새 캔버스 생성
            const canvas = document.createElement('canvas');
            canvas.width = crop.width;
            canvas.height = crop.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('2D context를 얻을 수 없습니다.'));

            // 원본 이미지(img)에서 crop 영역만큼을 잘라 새 캔버스에 그립니다.
            ctx.drawImage(
                img,
                crop.x,      // 원본에서 복사할 영역의 시작 X
                crop.y,      // 원본에서 복사할 영역의 시작 Y
                crop.width,  // 복사할 영역의 너비
                crop.height, // 복사할 영역의 높이
                0,           // 새 캔버스에 그릴 위치 X
                0,           // 새 캔버스에 그릴 위치 Y
                crop.width,  // 그릴 이미지의 너비
                crop.height  // 그릴 이미지의 높이
            );
            // 새 캔버스의 내용을 새로운 데이터 URL로 만들어 반환
            resolve(canvas.toDataURL());
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}


// 실제 imageShape 구조에 맞춰 다중 이미지를 렌더링하는 컴포넌트
function MultipleCanvasImages({
                                  imageShapes = [],
                                  scaleFactor,
                              }: {
    imageShapes: Extract<CustomShapeConfig, { type: 'image' }>[];
    scaleFactor: number;
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
                newLoadingStates.set(shape.id ?? "", true);
            });
            setLoadingStates(newLoadingStates);

            for (const imageShape of imageShapes) {
                if (imageShape.imageDataUrl) {
                    try {
                        // --- ⬇️ 1. 이미지 URL 준비 ⬇️ ---
                        let finalImageUrl = imageShape.imageDataUrl;
                        // crop 정보가 있으면, 이미지를 미리 잘라냅니다.
                        if (imageShape.crop) {
                            finalImageUrl = await cropImageData(imageShape.imageDataUrl, imageShape.crop);
                        }
                        // --- ⬆️ 1. 이미지 URL 준비 ⬆️ ---

                        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
                            // 2. '잘라낸 이미지' 또는 '원본 이미지' URL로 텍스처를 로드합니다.
                            loader.load(
                                finalImageUrl,
                                (loadedTexture) => {
                                    loadedTexture.generateMipmaps = false;
                                    loadedTexture.minFilter = THREE.LinearFilter;
                                    loadedTexture.magFilter = THREE.LinearFilter;

                                    // --- ⬇️ 3. 텍스처 처리 로직 단순화 ⬇️ ---
                                    // 이미지가 미리 잘렸으므로 복잡한 crop 계산이 필요 없습니다.
                                    // 기존의 반전/회전 로직만 적용합니다.

                                    // 반전 처리
                                    loadedTexture.wrapS = THREE.RepeatWrapping;
                                    loadedTexture.repeat.x = -1;
                                    loadedTexture.offset.x = 1;

                                    // 회전
                                    loadedTexture.center.set(0.5, 0.5);
                                    loadedTexture.rotation = Math.PI / 2;
                                    // --- ⬆️ 3. 텍스처 처리 로직 단순화 ⬆️ ---

                                    loadedTexture.needsUpdate = true;
                                    resolve(loadedTexture);
                                },
                                undefined,
                                reject
                            );
                        });

                        newTextures.set(imageShape.id ?? "", texture);
                    } catch (error) {
                        console.warn(`이미지 텍스처 로드 실패: ${imageShape.name} (${imageShape.id})`, error);
                    } finally {
                        newLoadingStates.set(imageShape.id ?? "", false);
                    }
                } else {
                    newLoadingStates.set(imageShape.id ?? "", false);
                }
            }

            setTextures(newTextures);
            setLoadingStates(newLoadingStates);
        };

        if (imageShapes.length > 0) {
            loadTextures();
        } else {
            // // 이미지가 없을 때 상태 초기화
            // setTextures(new Map());
            // setLoadingStates(new Map());
        }

        // 의존성 변경/언마운트 시 기존 텍스처 자원 해제
        return () => {
            textures.forEach((tex) => {
                try { tex.dispose(); } catch {}
            });
        };
    }, [imageShapes, textures]);


    if (imageShapes.length === 0) {
        return null;
    }

    return (
        <group>
            {imageShapes.map((imageShape) => {
                const texture = textures.get(imageShape.id ?? "");
                const isLoading = loadingStates.get(imageShape.id ?? "") ?? false;

                // ✅ crop된 영역의 실제 크기와 위치 계산
                const baseX = imageShape.x ?? 0;
                const baseY = imageShape.y ?? 0;
                const scaleX = imageShape.scaleX ?? 1;
                const scaleY = imageShape.scaleY ?? 1;
                const rotation = imageShape.rotation ?? 0;
                const visible = imageShape.visible ?? true;

                let effectiveX, effectiveY, effectiveWidth, effectiveHeight;

                effectiveX = baseX;
                effectiveY = baseY;
                effectiveWidth = (imageShape.width ?? 0) * scaleX;
                effectiveHeight = (imageShape.height ?? 0) * scaleY;

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
                            <planeGeometry args={[actualWidth, actualHeight]}/>
                            <meshBasicMaterial
                                color="#666666"
                                transparent
                                opacity={0.6}
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
                        userData={{
                            imageShape,
                            effectiveBounds: {
                                x: effectiveX,
                                y: effectiveY,
                                width: effectiveWidth,
                                height: effectiveHeight
                            }
                        }}
                    >
                        <planeGeometry args={[actualWidth, actualHeight]}/>
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
function ToolHead({position, scaleFactor}: { position: number[], scaleFactor: number }) {
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
            <cylinderGeometry args={[0.5, 0.5, cylinderHeight]}/>
            <meshStandardMaterial color="lime"/>
        </mesh>
    );
}


function GCodePath({pathData = [], scaleFactor, activeCount = 0}: {
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

const Preview3D = ({
                       toolheadPos, pathData = [], activeCount = 0, imageShapes,orthographicView = true
                   }: MotionBoard3DProps) => {
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
    const gridCenter = Math.max(scaledWorkArea.width, scaledWorkArea.height) / 2;

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

    // 직교 카메라용 줌 레벨을 적당한 크기로 조정
    const orthographicZoom = useMemo(() => {
        const maxDimension = Math.max(scaledWorkArea.width, scaledWorkArea.height);
        // 줌을 적당한 크기로 설정 (너무 크지도 작지도 않게)
        return Math.max(3, 100 / maxDimension); // 줌을 줄여서 전체적으로 보이게
    }, [scaledWorkArea]);


    return (
        <Canvas
            style={{background: '#111111'}}
            gl={{powerPreference: 'high-performance', antialias: true}}
        >
            {/* 조건부로 카메라 타입 선택 */}
            {orthographicView ? (
                <OrthographicCamera
                    makeDefault
                    zoom={orthographicZoom}
                    // 카메라를 비스듬히 위에서 보는 각도로 배치 (첫 번째 사진처럼)
                    position={[scaledWorkArea.width / 2, scaledWorkArea.height * 1.2, scaledWorkArea.height / 2]}
                    near={0.1}
                    far={1000}
                    // 작업 영역 중앙을 바라보도록 설정
                    onUpdate={(camera) => {
                        // 먼저 회전 설정
                        camera.rotation.set(0, -Math.PI / 2, 0);
                        camera.up.set(0, 1, 0);
                        // 그 다음 lookAt 설정
                        camera.lookAt(scaledWorkArea.width / 2, 0, scaledWorkArea.height / 2);
                        camera.updateProjectionMatrix();
                    }}
                />
            ) : (
                // 원근 카메라는 Canvas의 기본 설정을 사용
                <></>
            )}

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
            <MultipleCanvasImages
                imageShapes={finalImageShapes}
                scaleFactor={SCALE_FACTOR}
            />

            {/* OrbitControls 설정 - 직교 보기에서는 회전 제한 가능 */}
            <OrbitControls
                target={[scaledWorkArea.width / 2, 0, scaledWorkArea.height / 2]}
                enableDamping
                enablePan
                mouseButtons={{
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.PAN,
                }}
                enableZoom
                // 직교 카메라에서는 거리 제한 대신 줌 제한 사용
                minZoom={orthographicView ? 1 : undefined}
                maxZoom={orthographicView ? 100 : undefined}
                minDistance={orthographicView ? undefined : 5}
                maxDistance={orthographicView ? undefined : 100}
            />
        </Canvas>
    );
};

export default Preview3D;