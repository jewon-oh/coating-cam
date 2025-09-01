import {CoatingSettings} from "@/types/coating";
import {Point} from "@/lib/gcode/point";

/**
 * G-code 생성과 상태 추적을 전담하는 클래스
 * 현재 위치, 설정 등을 관리하며, G-code 명령어를 생성하고 추가합니다.
 */
export class GCodeEmitter {
    // 생성된 G-code 문자열을 저장합니다.
    private gcode: string = '';
    // 마지막 위치를 픽셀과 mm 단위로 모두 저장하여 변환 오류를 방지합니다.
    private lastPixelPosition: Point = { x: 0, y: 0, z: 0 }; // z는 mm 단위
    private lastMmPosition: Point = { x: 0, y: 0, z: 0 };
    private readonly settings: CoatingSettings;
    private readonly pixelsPerMm: number;

    constructor(settings: CoatingSettings) {
        this.settings = settings;
        this.pixelsPerMm = settings.pixelsPerMm > 0 ? settings.pixelsPerMm : 10; // 기본값 폴백
        // 초기 Z 위치는 mm 단위의 안전 높이입니다.
        this.lastMmPosition.z = settings.safeHeight;
        this.lastPixelPosition.z = settings.safeHeight;
    }

    /**
     * 픽셀 단위를 mm 단위로 변환합니다.
     */
    private toMM(pixel: number): number {
        return pixel / this.pixelsPerMm;
    }

    /**
     * G-code 문자열에 한 줄을 추가합니다.
     * @param line G-code 명령어 한 줄
     */
    addLine(line: string) {
        this.gcode += line + '\n';
    }

    /**
     * 지정된 좌표로 이동하는 내부 로직
     * @param x X좌표
     * @param y Y좌표
     * @param z Z좌표 (선택 사항)
     * @param speed 이동 속도 (F값)
     * @param isRapid 고속 이동(G0)인지, 직선 이동(G1)인지
     */
    private moveTo(x: number, y: number, z: number | undefined, speed: number, isRapid: boolean) {
        const mmX = this.toMM(x);
        const mmY = this.toMM(y);

        // 마지막 mm 위치와 비교하여 불필요한 이동 명령을 방지합니다.
        if (
            Math.abs(this.lastMmPosition.x - mmX) < 0.001 &&
            Math.abs(this.lastMmPosition.y - mmY) < 0.001 &&
            (z === undefined || z === null || Math.abs(this.lastMmPosition.z! - z) < 0.001)
        ) {
            return;
        }

        const command = isRapid ? 'G0' : 'G1';
        this.addLine(
            `${command} F${speed} X${mmX.toFixed(3)} Y${mmY.toFixed(3)}${
                z !== undefined && z !== null ? ` Z${z.toFixed(3)}` : ''
            }`,
        );

        // 마지막 위치를 픽셀과 mm 단위로 모두 업데이트합니다.
        this.lastPixelPosition = { x, y, z: z ?? this.lastMmPosition.z };
        this.lastMmPosition = { x: mmX, y: mmY, z: z ?? this.lastMmPosition.z };
    }

    /**
     * 고속 이동(G0)을 사용하여 지정된 위치로 이동합니다.
     * @param x X좌표
     * @param y Y좌표
     * @param z Z좌표 (선택 사항)
     */
    public travelTo(x: number, y: number, z?: number) {
        this.moveTo(x, y, z, this.settings.moveSpeed, true);
    }

    /**
     * [신규] 지정된 속도를 사용하여 코팅(G1) 이동을 합니다.
     * @param x X좌표
     * @param y Y좌표
     * @param speed 이동 속도 (F값)
     */
    public coatToWithSpeed(x: number, y: number, speed: number) {
        this.moveTo(x, y, this.lastMmPosition.z, speed, false);
    }

    /**
     * 코팅 속도(G1)를 사용하여 현재 Z높이에서 지정된 위치로 이동합니다.
     * @param x X좌표
     * @param y Y좌표
     */
    public coatTo(x: number, y: number) {
        this.moveTo(x, y, this.lastMmPosition.z, this.settings.coatingSpeed, false);
    }

    /**
     * 코팅 높이(G1)에서 지정된 위치로 이동합니다.
     * @param x X좌표
     * @param y Y좌표
     */
    public travelAtCoatingHeight(x: number, y: number) {
        this.moveTo(x, y, this.settings.coatingHeight, this.settings.moveSpeed, false);
    }

    /**
     * Z축 높이를 설정합니다. (고속 이동)
     * @param z Z좌표
     */
    public setZ(z: number) {
        // 마지막 픽셀 위치를 기준으로 Z축만 변경합니다.
        this.moveTo(this.lastPixelPosition.x, this.lastPixelPosition.y, z, this.settings.moveSpeed, true);
    }

    /**
     * [선택] 코팅 높이로 내리되, 필요 시 개별 높이를 적용해 사용할 수 있습니다.
     * 내부적으로는 setZ를 사용합니다.
     */
    public setCoatingZ(z: number) {
        this.setZ(z);
    }

    /**
     * 노즐 ON 명령(M503)을 추가합니다.
     */
    public nozzleOn() {
        this.addLine('M503 ; Nozzle ON');
    }

    /**
     * 노즐 OFF 명령(M504)을 추가합니다.
     */
    public nozzleOff() {
        this.addLine('M504 ; Nozzle OFF');
    }

    /**
     * 현재 위치를 반환합니다.
     * @returns 현재 위치
     */
    public getCurrentPosition(): Point {
        return { ...this.lastPixelPosition, z: this.lastMmPosition.z };
    }

    /**
     * 최종 G-code 문자열을 반환합니다.
     * @returns 생성된 G-code
     */
    public getGCode(): string {
        return this.gcode;
    }
}
