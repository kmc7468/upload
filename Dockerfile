FROM python:3.10
WORKDIR /usr/src/app

COPY main.py .
COPY requirements.txt .

RUN ["pip", "install", "-r", "requirements.txt"]

ENTRYPOINT ["python", "main.py"]