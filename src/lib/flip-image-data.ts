// lib/utils.ts 또는 적절한 위치에 추가

export function flipImageData(dataUrl: string, direction: 'horizontal' | 'vertical'): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('2D context를 얻을 수 없습니다.'));

            if (direction === 'horizontal') {
                ctx.translate(img.width, 0);
                ctx.scale(-1, 1);
            } else {
                ctx.translate(0, img.height);
                ctx.scale(1, -1);
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}