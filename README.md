# Minchan's Upload
파일을 손쉽게 업로드/다운로드할 수 있는 웹 사이트입니다.

## Features
- 웹 브라우저와 `curl` 명령어를 통해 파일을 손쉽게 업로드/다운로드할 수 있습니다.
- HEIF 등 다양한 포맷의 이미지를 JPEG 또는 PNG 포맷으로 변환할 수도 있습니다.
- 업로드된 파일을 램 디스크에 저장하여, 드라이브 수명 단축을 최소화합니다.

## Deployment
Docker Compose의 사용을 권장합니다.
```bash
git clone https://github.com/kmc7468/upload
cd upload
vim .env # Optional: 환경 변수를 설정할 경우에만 실행하세요.
docker compose up --build -d
```

로그 파일은 Docker 컨테이너 내부의 `/usr/src/app/logs` 디렉터리에 저장되며, 컨테이너를 재시작해도 로그 파일은 계속 보존됩니다.

## Environment Variables
모든 환경 변수는 Optional입니다.
|이름|기본 값|설명|
|:-|:-|:-|
|PORT|80|Docker 컨테이너 내부로 연결될 호스트의 포트입니다.|
|ID_CHARS|*생략*|업로드된 파일마다 할당되는 아이디를 구성하는 문자입니다. 기본 값은 알파벳 대소문자 및 숫자입니다.|
|ID_LENGTH|6|업로드된 파일마다 할당되는 아이디의 길이입니다.|
|FILE_EXPIRY|3600|업로드된 파일이 저장되어 있는 시간입니다. 기본 값은 1시간입니다.|
|TMPFS_SIZE|2G|업로드된 파일이 저장되는 램 디스크의 최대 크기입니다.|
|MAX_FILE_SIZE|1073741824|업로드할 수 있는 파일의 최대 크기입니다. 기본 값은 1 GiB 입니다.|
|MAX_CONVERTIBLE_IMAGE_SIZE|31457280|포맷을 변환할 수 있는 이미지 파일의 최대 크기입니다. 기본 값은 30 MiB 입니다.|
|TRUST_PROXY||신뢰할 수 있는 프록시 서버의 수입니다. 설정할 경우, 반드시 1 이상의 값을 사용해 주세요.|

## Special Thanks
- [DoyunShin/UPServer](https://github.com/DoyunShin/UPServer)로부터 많은 영향을 받았습니다. 감사합니다.