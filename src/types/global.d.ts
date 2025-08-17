// settings-context.tsx에서 정의한 SettingsFile 타입을 가져옵니다.
// 이 타입을 재사용하여 타입 안정성을 높일 수 있습니다.
import {SettingsFile} from '@/contexts/settings-context';

export declare global {
    // 전역 Window 인터페이스를 확장합니다.
    interface Window {
        /**
         * 앱 설정(settings.json)을 읽고 쓰기 위한 API
         */
        settingsApi: {
            /**
             * 파일에서 설정 정보를 읽어옵니다.
             * @returns Promise<SettingsFile | null>
             */
            load: () => Promise<SettingsFile | null>;
            /**
             * 현재 설정 정보를 파일에 저장합니다.
             * @param data 저장할 설정 객체
             */
            save: (data: SettingsFile) => void;
        };
        /**
         * 프로젝트 파일 다이얼로그 및 파일 I/O API
         */
        projectApi: {
            /**
             * 파일 열기 다이얼로그를 표시합니다.
             * @param options 다이얼로그 옵션
             * @returns Promise<Electron.OpenDialogReturnValue>
             */
            showOpenDialog: (options: OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;

            /**
             * 파일 저장 다이얼로그를 표시합니다.
             * @param options 다이얼로그 옵션
             * @returns Promise<Electron.SaveDialogReturnValue>
             */
            showSaveDialog: (options: SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;

            /**
             * 지정된 경로의 파일을 읽어 문자열로 반환합니다.
             * @param filePath 파일 경로
             * @param encoding 인코딩
             * @returns Promise<string> 파일 내용
             */
            readFile: (filePath: string, encoding?: BufferEncoding) => Promise<string>;

            /**
             * 지정된 경로에 문자열 내용을 파일로 저장합니다.
             * @param filePath 파일 경로
             * @param content 저장할 내용
             * @param encoding 인코딩
             * @returns Promise<boolean> 성공 여부
             */
            writeFile: (filePath: string, content: string, encoding?: BufferEncoding) => Promise<boolean>;
        };


    }
}