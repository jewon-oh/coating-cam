// TypeScript
/**
 * 긴 문자열을 ... 로 축약합니다.
 * - 유니코드 코드포인트 기준으로 안전하게 처리합니다(이모지/서로게이트 쌍 대응).
 * - mode='end' | 'middle' 지원
 * - preserveExtension=true 시, 파일 확장자를 보존(end 모드에서만)
 */
export type EllipsizeOptions = {
    mode?: 'end' | 'middle';
    preserveExtension?: boolean; // end 모드에서만 유효
};

export function ellipsize(input: string, maxLength: number, options: EllipsizeOptions = {}): string {
    const { mode = 'end', preserveExtension = false } = options;


    if (!Number.isFinite(maxLength) || maxLength <= 0) return '';

    const cps = Array.from(input); // 코드포인트 단위
    if (cps.length <= maxLength) return input;

    // maxLength가 1 이하일 때는 …만 표시
    if (maxLength === 1) return '…';

    if (mode === 'middle') {
        // 가운데 축약: 앞/뒤를 남기고 가운데를 …
        const slots = maxLength - 1; // … 포함 자리
        const head = Math.ceil(slots / 2);
        const tail = Math.floor(slots / 2);
        const left = cps.slice(0, head).join('');
        const right = cps.slice(cps.length - tail).join('');
        return `${left}…${right}`;
    }

    // mode === 'end'
    if (preserveExtension) {
        // 마지막 점 기준으로 확장자 추정 (숨김파일 ".env"는 확장자로 보지 않음)
        const lastDot = input.lastIndexOf('.');
        const hasExt = lastDot > 0 && lastDot < input.length - 1;
        if (hasExt) {
            const extCps = Array.from(input.slice(lastDot)); // ".png" 포함
            const roomForName = maxLength - 1 - extCps.length; // 본문 + … + 확장자
            if (roomForName > 0) {
                const namePart = cps.slice(0, roomForName).join('');
                const extPart = extCps.join('');
                return `${namePart}…${extPart}`;
            }
            // 확장자가 너무 길어 전체 길이 초과 시, 일반 end 축약으로 폴백
        }
    }

    // 기본: 끝 축약
    const visible = cps.slice(0, maxLength - 1).join('');
    return `${visible}…`;
}

// 편의 래퍼들
export function ellipsizeEnd(input: string, maxLength: number) {
    return ellipsize(input, maxLength, { mode: 'end' });
}

export function ellipsizeMiddle(input: string, maxLength: number) {
    return ellipsize(input, maxLength, { mode: 'middle' });
}

export function ellipsizeFileName(input: string, maxLength: number) {
    return ellipsize(input, maxLength, { mode: 'end', preserveExtension: true });
}