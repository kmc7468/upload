FROM python:3.10-alpine
WORKDIR /usr/src/app

RUN ["apk", "update"]
RUN ["apk", "add", "libmagic"]

COPY requirements.txt .
RUN ["pip", "install", "-r", "requirements.txt"]

COPY static static
COPY main.py .

ENTRYPOINT ["python", "-u", "main.py"]