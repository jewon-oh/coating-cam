import {FillPattern} from "@/types/coating";

/**
 * 도형 채우기 패턴을 그리는 Canvas를 생성합니다.
 * @param shapeType 'rectangle' | 'circle'
 * @param width 패턴이 그려질 영역의 너비
 * @param height 패턴이 그려질 영역의 높이
 * @param lineSpacing 라인 간격 (px)
 * @param coatingWidth 코팅 폭 (px)
 * @param fillPattern 채우기 패턴 종류
 * @returns 패턴이 그려진 HTMLCanvasElement
 */
export const createCoatingPatternCanvas = (
    shapeType: 'rectangle' | 'circle',
    width: number,
    height: number,
    lineSpacing: number, // in px
    coatingWidth: number, // in px
    fillPattern: FillPattern,
): HTMLCanvasElement | undefined => {
    if (width <= 0 || height <= 0 || lineSpacing <= 0) {
        return undefined;
    }

    const patternCanvas = document.createElement('canvas');
    const ctx = patternCanvas.getContext('2d');
    if (!ctx) return undefined;

    const lineSpacingPx = lineSpacing;
    const coatingWidthPx = coatingWidth > 0 ? coatingWidth : 1;

    patternCanvas.width = width;
    patternCanvas.height = height;

    if (lineSpacingPx <= 0) return patternCanvas;

    if (fillPattern === 'vertical' || fillPattern === 'horizontal') {
        ctx.fillStyle = 'rgba(30, 144, 255, 0.5)';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;

        if (fillPattern === 'vertical') {
            // ✨ FIX: Math.floor를 Math.round로 변경하여 부동 소수점 오차에 대응
            const lineCount = Math.round(width / lineSpacingPx);
            const patternWidth = (lineCount - 1) * lineSpacingPx;
            const margin = (width - patternWidth) / 2;

            for (let i = 0; i < lineCount; i++) {
                const x = margin + i * lineSpacingPx;
                if (coatingWidth > 0) {
                    ctx.fillRect(x - coatingWidth / 2, 0, coatingWidth, height);
                }
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        } else { // horizontal
            // ✨ FIX: Math.floor를 Math.round로 변경하여 부동 소수점 오차에 대응
            const lineCount = Math.round(height / lineSpacingPx);
            const patternHeight = (lineCount - 1) * lineSpacingPx;
            const margin = (height - patternHeight) / 2;

            for (let i = 0; i < lineCount; i++) {
                const y = margin + i * lineSpacingPx;
                if (coatingWidth > 0) {
                    ctx.fillRect(0, y - coatingWidth / 2, width, coatingWidth);
                }
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }
    } else if (fillPattern === 'concentric') {
        const centerX = width / 2;
        const centerY = height / 2;

        const buildConcentricPath = () => {
            ctx.beginPath();
            if (shapeType === 'rectangle') {
                const aspect = height / width;
                let w = width - lineSpacingPx;
                let h = height - lineSpacingPx * aspect;
                while (w > 0 && h > 0) {
                    ctx.rect(centerX - w / 2, centerY - h / 2, w, h);
                    w -= lineSpacingPx * 2;
                    h -= lineSpacingPx * 2 * aspect;
                }
            } else { // circle
                let radius = (Math.min(width, height) / 2) - lineSpacingPx / 2;
                while (radius > 0) {
                    ctx.moveTo(centerX + radius, centerY);
                    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                    radius -= lineSpacingPx;
                }
            }
        };

        if (coatingWidthPx > 0) {
            buildConcentricPath();
            ctx.strokeStyle = 'rgba(30, 144, 255, 0.5)';
            ctx.lineWidth = coatingWidthPx;
            ctx.stroke();
        }

        buildConcentricPath();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    return patternCanvas;
};