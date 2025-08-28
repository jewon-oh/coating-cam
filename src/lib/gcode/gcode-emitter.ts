import {CoatingSettings} from "@/types/coating";
import {Point} from "@/lib/gcode/point";

/**
 * G-code 생성과 상태 추적을 전담하는 클래스
 * 현재 위치, 설정 등을 관리하며, G-code 명령어를 생성하고 추가합니다.
 */
export class GCodeEmitter {
    // 생성된 G-code 문자열을 저장합니다.
    private gcode: string = '';
    // 마지막으로 이동한 위치를 추적하여 불필요한 이동 명령을 방지합니다.
    private lastPosition: Point = {x: 0, y: 0, z: 0};
    // G-code 생성에 필요한 설정을 담고 있습니다. (예: 속도, 높이)
    private readonly settings: CoatingSettings;

    constructor(settings: CoatingSettings) {
        this.settings = settings;
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
        // 마지막 위치와 동일할 경우, 불필요한 명령을 생성하지 않습니다.
        if (
            Math.abs(this.lastPosition.x - x) < 0.01 &&
            Math.abs(this.lastPosition.y - y) < 0.01 &&
            (z === undefined || z === null || Math.abs(this.lastPosition.z! - z) < 0.01)
        ) {
            return;
        }

        const command = isRapid ? 'G0' : 'G1'; // G0 또는 G1 명령어 선택
        this.addLine(
            // G-code 문자열을 형식에 맞게 생성합니다.
            `${command} F${speed} X${x.toFixed(3)} Y${y.toFixed(3)}${
                z !== undefined && z !== null ? ` Z${z.toFixed(3)}` : ''
            }`,
        );
        // 마지막 위치를 현재 위치로 업데이트합니다.
        this.lastPosition = {x, y, z: z ?? this.lastPosition.z};
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

    // --- ⬇️ 새로운 메서드 추가 ⬇️ ---
    /**
     * [신규] 지정된 속도를 사용하여 코팅(G1) 이동을 합니다.
     * @param x X좌표
     * @param y Y좌표
     * @param speed 이동 속도 (F값)
     */
    public coatToWithSpeed(x: number, y: number, speed: number) {
        this.moveTo(x, y, this.lastPosition.z, speed, false);
    }

    /**
     * 코팅 속도(G1)를 사용하여 현재 Z높이에서 지정된 위치로 이동합니다.
     * @param x X좌표
     * @param y Y좌표
     */
    public coatTo(x: number, y: number) {
        this.moveTo(x, y, this.lastPosition.z, this.settings.coatingSpeed, false);
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
        this.moveTo(this.lastPosition.x, this.lastPosition.y, z, this.settings.moveSpeed, true);
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
        return {...this.lastPosition};
    }

    /**
     * 최종 G-code 문자열을 반환합니다.
     * @returns 생성된 G-code
     */
    public getGCode(): string {
        return this.gcode;
    }
}
