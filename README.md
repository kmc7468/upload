# Minchan's Upload
파일을 손쉽게 업로드, 다운로드할 수 있는 웹 사이트입니다.

## Features
- 웹 브라우저와 `curl` 명령어를 통해 손쉽게 파일을 업로드, 다운로드할 수 있습니다.
- 환경 변수를 설정하여, 코드를 수정하지 않고도 서버 관리자에 맞게 웹 사이트를 개인화(customize)할 수 있습니다.
- 제공되는 `docker-compose.yml` 파일을 이용할 경우, 업로드된 파일을 램 디스크에 저장합니다.

## Environment Variables
- `PORT`: 서버가 실행되는 포트입니다. 기본 값은 80입니다.
- `ID_LENGTH`: 업로드된 파일마다 부여되는 ID의 길이입니다. 기본 값은 6입니다.
- `MAX_FILE_SIZE`: 업로드할 수 있는 파일의 최대 크기(bytes)입니다. 기본 값은 1 GiB입니다.
- `FILE_EXPIRES`: 업로드된 파일의 유효 시간(seconds)입니다. 기본 값은 1시간입니다.
- `TRUST_PROXY`: 신뢰할 수 있는 프록시 서버의 수입니다. 기본 값은 0입니다. 클라이언트의 IP 주소를 가져올 때 사용되는 값입니다.
- `DIRECTORY`: 업로드된 파일이 저장되는 디렉터리의 경로입니다. 제공되는 `docker-compose.yml` 파일을 이용할 경우, `/usr/src/app/uploads`로 고정됩니다. 그렇지 않을 경우, **값을 반드시 설정**해야 합니다.
- `LOG_DIRECTORY`: 로그 파일이 저장되는 디렉터리의 경로입니다. 제공되는 `docker-compose.yml` 파일을 이용할 경우, `/usr/src/app/logs`로 고정됩니다. 그렇지 않을 경우, **값을 반드시 설정**해야 합니다.

## How to install
```
$ git clone https://github.com/kmc7468/upload
$ cd upload
```

### 1. 제공되는 `docker-compose.yml` 파일을 이용할 경우
```
$ docker compose up --build -d
```
환경 변수를 설정하기 위해 `.env` 파일을 사용할 수도 있습니다.

### 2. 그렇지 않을 경우
```
$ export DIRECTORY=uploads
$ export LOG_DIRECTORY=logs
$ python main.py
```

## Special Thanks
- [DoyunShin/UPServer](https://github.com/DoyunShin/UPServer)로부터 많은 영향을 받았습니다. 감사합니다.