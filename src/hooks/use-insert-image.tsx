import { useCallback } from 'react';
import {useAppDispatch, useAppSelector} from '@/hooks/redux';
import { addShapeToBack } from '@/store/slices/shapes-slice';
import { setTool } from '@/store/slices/tool-slice';
import {setPresent} from "@/store/slices/history-slice";

type Size = { width: number; height: number };

function supportsWebp(): boolean {
    try {
        const c = document.createElement('canvas');
        return c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
        return false;
    }
}

// 비트맵 로딩 (EXIF 방향 자동 적용 시도)
async function loadBitmapFromFile(file: File): Promise<ImageBitmap> {
    // 일부 브라우저는 imageOrientation 옵션을 지원
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image', premultiplyAlpha: 'default' });
    } catch {
        // 폴백: File -> HTMLImageElement
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = url;
        });
        const bmp = await createImageBitmap(img);
        URL.revokeObjectURL(url);
        return bmp;
    }
}

// 다운스케일 목표 크기 계산
function fitSize(src: Size, opts: { maxEdge?: number; maxMP?: number }): Size {
    const { maxEdge = 2048, maxMP = 4_000_000 } = opts;
    const { width, height } = src;

    // 우선 최대 변 기준 축소
    let scale = Math.min(1, maxEdge / Math.max(width, height));

    // 총 픽셀(메가픽셀) 제한도 적용
    const mpScale = Math.sqrt(Math.min(1, maxMP / (width * height)));
    scale = Math.min(scale, mpScale);

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    return { width: w, height: h };
}

// 점진적 다운스케일 (계단 현상 감소)
function multistepDownscale(
    src: ImageBitmap | HTMLCanvasElement,
    target: Size
): HTMLCanvasElement {
    const hasOffscreen = typeof window.OffscreenCanvas === 'function';
    const makeCanvas = (w: number, h: number) => {
        if (hasOffscreen) {
            const off = new window.OffscreenCanvas(w, h);
            return off as unknown as HTMLCanvasElement; // 타입 호환용
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    };

    let curCanvas = makeCanvas((src as any).width, (src as any).height);
    let ctx = curCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, curCanvas.width, curCanvas.height);
    ctx.drawImage(src as any, 0, 0);

    // 단계적으로 절반씩 축소하며 목표에 근접
    const steps = [];
    let w = curCanvas.width;
    let h = curCanvas.height;

    while (w * 0.5 > target.width && h * 0.5 > target.height) {
        w = Math.max(target.width, Math.round(w * 0.5));
        h = Math.max(target.height, Math.round(h * 0.5));
        steps.push({ w, h });
    }
    steps.push({ w: target.width, h: target.height });

    for (const s of steps) {
        const nextCanvas = makeCanvas(s.w, s.h);
        const nctx = nextCanvas.getContext('2d', { willReadFrequently: true })!;
        nctx.imageSmoothingEnabled = true;
        nctx.imageSmoothingQuality = 'high';
        nctx.clearRect(0, 0, s.w, s.h);
        nctx.drawImage(curCanvas as any, 0, 0, s.w, s.h);
        curCanvas = nextCanvas;
        ctx = nctx;
    }

    // DOM 캔버스로 보장(OffscreenCanvas → transferToImageBitmap 대신 dataURL을 쓸 것이므로)
    if (!(curCanvas instanceof HTMLCanvasElement)) {
        const domCanvas = document.createElement('canvas');
        domCanvas.width = curCanvas.width;
        domCanvas.height = curCanvas.height;
        const dctx = domCanvas.getContext('2d', { willReadFrequently: true })!;
        dctx.drawImage(curCanvas as any, 0, 0);
        return domCanvas;
    }
    return curCanvas;
}

// 알파 채널 필요 여부 추정: PNG/WEBP는 알파 가능, JPEG은 불가능
function inferAlphaNeeded(file: File): boolean {
    const t = file.type.toLowerCase();
    if (t.includes('png')) return true;
    // webp도 알파 가능하나, 원본 jpg면 알파 불필요일 확률 높음
    return false;
}

// 캔버스를 최적 포맷으로 인코딩
function canvasToOptimizedDataUrl(
    canvas: HTMLCanvasElement,
    prefersAlpha: boolean,
    quality = 0.85
): string {
    const webpOK = supportsWebp();
    if (!prefersAlpha) {
        // 알파 불필요 → WebP 또는 JPEG로 압축
        if (webpOK) return canvas.toDataURL('image/webp', quality);
        return canvas.toDataURL('image/jpeg', quality);
    }
    // 알파 필요 → WebP(있으면) 또는 PNG
    if (webpOK) return canvas.toDataURL('image/webp', quality);
    return canvas.toDataURL('image/png');
}

// 최적화 파이프라인: File → dataURL(압축/리사이즈/방향보정)
async function optimizeImageFile(file: File, opts?: {
    maxEdge?: number;   // 최대 변 길이 (px)
    maxMP?: number;     // 최대 메가픽셀 수 (px*px)
    quality?: number;   // 0..1
}): Promise<{ dataUrl: string; displaySize: Size; naturalSize: Size }> {
    const quality = opts?.quality ?? 0.85;
    const maxEdge = opts?.maxEdge ?? 2048;
    const maxMP = opts?.maxMP ?? 4_000_000;

    const bmp = await loadBitmapFromFile(file);
    const natural: Size = { width: bmp.width, height: bmp.height };
    const target = fitSize(natural, { maxEdge, maxMP });

    // 다운스케일 필요 없으면 바로 인코딩(재인코딩으로 메타 제거)
    let canvas: HTMLCanvasElement;
    if (target.width === natural.width && target.height === natural.height) {
        canvas = document.createElement('canvas');
        canvas.width = natural.width;
        canvas.height = natural.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0);
    } else {
        canvas = multistepDownscale(bmp, target);
    }

    const prefersAlpha = inferAlphaNeeded(file);
    const dataUrl = canvasToOptimizedDataUrl(canvas, prefersAlpha, quality);

    // 캔버스 메모리 해제 힌트
    try { bmp.close?.(); } catch {}

    // 디스플레이 기본 크기(캔버스에 올릴 때)
    const displayMaxEdge = 800;
    const dispScale = Math.min(1, displayMaxEdge / Math.max(target.width, target.height));
    const displaySize = {
        width: Math.round(target.width * dispScale),
        height: Math.round(target.height * dispScale),
    };

    return { dataUrl, displaySize, naturalSize: target };
}

export const useInsertImage = () => {
    const dispatch = useAppDispatch();
    const currentShapes = useAppSelector((state) => state.shapes.shapes);

    const handleImageInsert = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            try {
                // 최적화 파이프라인 호출
                const { dataUrl, displaySize } = await optimizeImageFile(file, {
                    maxEdge: 2048,   // 최대 변 2048px
                    maxMP: 4_000_000,// 최대 4MP
                    quality: 0.85,   // 압축 품질
                });

                // 새 이미지 도형 생성
                const newImageShape = {
                    id: crypto.randomUUID(),
                    parentId: null,
                    type: 'image' as const,
                    name: '이미지',
                    x: 150,
                    y: 50,
                    width: displaySize.width,
                    height: displaySize.height,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                    imageDataUrl: dataUrl,
                    isFlipped: false, // 👈 "아직 뒤집히지 않음" 플래그 추가
                    visible: true,
                    isLocked: false,
                    coatingType: 'fill',
                };

                // 도형 추가
                dispatch(addShapeToBack(newImageShape));

                // 히스토리에 현재 상태 저장 (이미지 추가 전)
                dispatch(setPresent(currentShapes));
                // 이미지 추가 후 히스토리 기록 (새로운 상태로)
                const next = [newImageShape, ...currentShapes];
                dispatch(setPresent(next));

                dispatch(setTool('select'));
            } catch (err) {
                console.error('이미지 최적화 실패:', err);
                alert('이미지 최적화 중 오류가 발생했습니다.');
            } finally {
                // input 값 초기화
                input.value = '';
            }
        };

        input.click();
    }, [dispatch]);

    return { handleImageInsert };
};