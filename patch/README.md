# 의존성 패치
## 수정 사항
- `Content-Type` Header가 존재하지 않더라도 Body를 읽을 수 있도록 수정하였습니다.
  - [@sveltejs/adapter-node/files/handler.js](./@sveltejs/adapter-node/files/handler.js)
  - [@sveltejs/kit/src/exports/node/index.js](./@sveltejs/kit/src/exports/node/index.js)

## 주의 사항
`node_modules` 내의 소스 코드를 직접 수정하므로, Docker 컨테이너 내부에서만 적용하는 것을 권장합니다. 그렇지 않을 경우, 다른 프로그램에도 영향을 줄 수 있습니다.

## 라이선스
- 의존성 패치의 라이선스는 원본 소스 코드의 라이선스를 따릅니다.
- 이 레포지토리에서 수정한 부분 이외의 저작권은 원저작자에게 있습니다.