import {useEffect, useState} from "react";
import {CustomShapeConfig} from "@/types/custom-konva-config";
import {   Text} from "@react-three/drei";
import * as THREE from "three";

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
export default function Preview3DImages({
                                  imageShapes,
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
