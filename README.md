# Coating CAM - 코팅용 G-Code 생성기

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://gitea.local.fresh96jwjw.org/jw/coating-cam)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61dafb.svg)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-37.2.6-47848f.svg)](https://electronjs.org/)

> 이미지를 정밀한 G-Code로 변환하는 전문적인 CAM 소프트웨어

## 🎯 프로젝트 개요

**Coating CAM**은 이미지를 업로드하고 캔버스에서 직관적으로 마스킹 영역을 설계하여 CNC 라우터, 3D 프린터, 레이저 커터 등에 사용할 수 있는 정밀한 G-Code를 생성하는 하이브리드 데스크톱/웹 애플리케이션입니다.

### ✨ 주요 특징
- 🖼️ **직관적인 이미지 편집**: 드래그 앤 드롭으로 이미지 업로드 및 실시간 미리보기
- 🎨 **비주얼 마스킹**: 캔버스에서 도형을 활용한 정밀한 마스킹 영역 설정
- 🗂️ **고급 그룹 관리**: 도형 그룹화, 해제, 복제 및 계층 구조 관리
- ⚙️ **고급 G-Code 설정**: 노즐 직경, 채우기 패턴, 이송속도 등 세밀한 제어
- 🔄 **실시간 미리보기**: 3D 시뮬레이션을 통한 공구 경로 확인
- 💾 **프로젝트 관리**: JSON 형태로 프로젝트 저장/불러오기 지원
- 🖥️ **하이브리드 플랫폼**: 웹브라우저와 데스크톱 앱 모두 지원

## 🚀 빠른 시작

### 시스템 요구사항
- **Node.js**: 18.0 이상
- **Yarn**: 1.22 이상 (권장)
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+

### 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone https://gitea.local.fresh96jwjw.org/jw/coating-cam.git
   cd coating-cam
   ```

2. **의존성 설치**
   ```bash
   yarn install
   ```

3. **개발 서버 실행**
   ```bash
   # 웹 버전 실행
   yarn dev
   
   # Electron 데스크톱 앱 실행
   yarn electron:dev
   ```

4. **브라우저에서 접속**: [http://localhost:3000](http://localhost:3000)

### 배포용 빌드
```bash

# 웹 배포용 빌드
yarn build

# Electron 앱 패키징
yarn electron:build

# 모든 플랫폼용 패키지 생성
yarn electron:dist
```

## 🛠️ 기술 스택

### Frontend
- **React 19.0**: 최신 React 기능 활용
- **Next.js 15.3**: SSR/SSG 지원 및 최적화
- **TypeScript**: 타입 안전성 보장
- **Tailwind CSS**: 유틸리티 우선 스타일링
- **Framer Motion**: 부드러운 애니메이션

### Canvas & 3D
- **Konva.js**: 고성능 2D 캔버스 렌더링
- **Three.js**: 3D G-Code 시뮬레이션
- **React Konva**: React와 Konva 통합

### 상태 관리 & 데이터
- **Redux Toolkit**: 예측 가능한 상태 관리
- **React Context**: 지역적 상태 공유
- **Lodash**: 유틸리티 함수 라이브러리

### 데스크톱 앱
- **Electron 37.2**: 크로스 플랫폼 데스크톱 앱
- **Electron Builder**: 자동 패키징 및 배포

### UI 라이브러리
- **Radix UI**: 접근성 우선 컴포넌트
- **shadcn/ui**: 현대적 UI 컴포넌트 시스템
- **Lucide React**: 아이콘 라이브러리

## 📋 구현된 기능

### ✅ 핵심 기능
- [x] **이미지 업로드 및 미리보기**: 다양한 형식 지원 (JPG, PNG, SVG)
- [x] **도형 기반 마스킹**: 사각형, 원형 마스킹 도구
- [x] **고급 도형 조작**: 이동, 크기 조절, 회전, 복사/붙여넣기
- [x] **스마트 그룹 관리**: 자동 그룹 생성, 해제, 복제 및 계층 구조 관리
- [x] **그룹 가시성 제어**: 그룹별 표시/숨김 및 잠금/해제 기능
- [x] **G-Code 생성 엔진**: 코팅/조각용 정밀 G-Code 출력
- [x] **3D 미리보기**: Three.js 기반 공구 경로 시뮬레이션
- [x] **무제한 실행 취소/다시 실행**: 최적화된 히스토리 관리
- [x] **프로젝트 저장/불러오기**: JSON 형태 프로젝트 파일

### ⚙️ 설정 및 최적화
- [x] **격자 시스템**: 스냅 기능이 있는 격자 표시
- [x] **테마 시스템**: 라이트/다크 모드 지원
- [x] **G-Code 템플릿**: 커스터마이징 가능한 헤더/푸터
- [x] **성능 최적화**: 가상화 및 지연 로딩
- [x] **반응형 디자인**: 다양한 화면 크기 지원
- [x] **객체 패널**: 계층 구조 기반 객체 관리 및 속성 편집

### 🎨 사용자 인터페이스
- [x] **직관적인 도구 패널**: 선택, 그리기, 확대/축소 도구
- [x] **속성 패널**: 실시간 객체 속성 편집
- [x] **상태 표시줄**: 현재 작업 상태 및 정보 표시
- [x] **키보드 단축키**: 효율적인 워크플로우 지원

### 🔧 G-Code 설정 옵션
- **기본 매개변수**: 노즐 직경, 채우기 간격, 이송속도
- **Z축 제어**: 안전 높이, 작업 높이 설정
- **속도 제어**: 이송속도, 작업속도 개별 설정
- **템플릿 시스템**: 시작/종료 G-Code 커스터마이징

## 🚧 개발 예정 기능

### 📝 단기 목표 (v0.2.0)
- [ ] **다양한 도형 지원**: 다각형, 베지어 곡선, 텍스트 도구
- [ ] **고급 그룹 기능**: 중첩 그룹 및 그룹 스타일 상속
- [ ] **레이어 시스템**: 시각적 레이어 관리 및 순서 제어
- [ ] **G-Code 최적화**: 경로 최적화 알고리즘 개선
- [ ] **파일 형식 확장**: DXF, SVG 파일 직접 임포트

### 🎯 중기 목표 (v0.3.0)
- [ ] **고급 채우기 패턴**: 지그재그, 나선형, 동심원 패턴
- [ ] **이미지 전처리**: 명암 조절, 엣지 검출, 임계값 설정
- [ ] **스크립트 자동화**: 반복 작업을 위한 매크로 기능
- [ ] **클라우드 동기화**: 프로젝트 클라우드 저장소 연동

### 🌟 장기 목표 (v1.0.0)
- [ ] **AI 지원 기능**: 이미지 자동 분석 및 최적 설정 제안
- [ ] **협업 기능**: 실시간 프로젝트 공유 및 공동 편집
- [ ] **하드웨어 연동**: CNC 장비 직접 제어 인터페이스

## 🧪 품질 보증

### 테스트 실행

```bash
# 전체 테스트 스위트 실행
yarn test
# 테스트 커버리지 확인
yarn test:coverage
# E2E 테스트 실행
yarn test:e2e
# 타입 체크, 린트, 테스트 모두 실행
yarn preflight
```


### 코드 품질 도구
- **ESLint**: 코드 품질 및 스타일 검사
- **TypeScript**: 컴파일 타임 타입 검사
- **Vitest**: 빠른 단위 테스트 프레임워크
- **Playwright**: E2E 테스트 자동화

## 📖 사용 가이드

### 기본 워크플로우

1. **프로젝트 시작**: 새 프로젝트 생성 또는 기존 파일 열기
2. **이미지 업로드**: 작업할 이미지를 드래그 앤 드롭으로 업로드
3. **마스킹 설계**: 캔버스에서 도형을 활용해 마스킹 영역 설정
4. **설정 조정**: G-Code 생성 매개변수 세밀 조정
5. **미리보기 확인**: 3D 뷰어에서 공구 경로 시뮬레이션
6. **G-Code 생성**: 최종 G-Code 파일 생성 및 다운로드

### 고급 사용법

#### 커스텀 G-Code 템플릿
```gcode
; 시작 템플릿 예시
G21 ; mm 단위 설정 
G90 ; 절대좌표 모드 
G0 Z{{safeHeight}} ; 안전 높이로 이동 
M3 S1000 ; 스핀들 시작

; 종료 템플릿 예시 
M5 ; 스핀들 정지 
G0 Z{{safeHeight}} ; 안전 높이로 복귀 
G0 X0 Y0 ; 원점 복귀
```

## 🤝 기여하기

프로젝트에 기여하고 싶으시다면 다음 단계를 따라주세요:

1. **Fork** 후 로컬에 클론
2. **Feature branch** 생성: `git checkout -b feature/amazing-feature`
3. **변경사항 커밋**: `git commit -m 'feat: Add amazing feature'`
4. **Branch에 Push**: `git push origin feature/amazing-feature`
5. **Pull Request** 생성

### 커밋 컨벤션
- `feat:` 새로운 기능 추가
- `fix:` 버그 수정
- `docs:` 문서 변경
- `style:` 코드 스타일 변경
- `refactor:` 리팩토링
- `test:` 테스트 추가/수정
- `chore:` 빌드, 패키지 등 기타 변경

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 도움을 받았습니다:

- [React](https://reactjs.org/) - UI 라이브러리
- [Next.js](https://nextjs.org/) - React 프레임워크
- [Electron](https://electronjs.org/) - 데스크톱 앱 플랫폼
- [Konva.js](https://konvajs.org/) - 2D 캔버스 라이브러리
- [Three.js](https://threejs.org/) - 3D 그래픽 라이브러리
- [Tailwind CSS](https://tailwindcss.com/) - CSS 프레임워크

[//]: # ()
[//]: # (## 📞 지원 및 문의)

[//]: # ()
[//]: # ()
[//]: # (- **이슈 트래커**: [GitHub Issues]&#40;https://github.com/your-username/gcodecraft/issues&#41;)

[//]: # ()
[//]: # (- **토론**: [GitHub Discussions]&#40;https://github.com/your-username/gcodecraft/discussions&#41;)

[//]: # ()
[//]: # (- **이메일**: [fresh96jwjw@gmail.com]&#40;fresh96jwjw@gmail.com&#41;)

---

<div>

**[⬆ 맨 위로](`#`)**

Made with ❤️ by [Jewon-Oh](https://github.com/jewon-oh)

</div>