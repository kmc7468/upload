FROM node:18-alpine
WORKDIR /usr/src/app

RUN ["apk", "update"]
RUN ["apk", "add", "g++", "make", "python3", "py3-pip", "vips-dev", "vips-heif"]

RUN ["npm", "install", "--global", "pnpm@8"];

COPY .npmrc package.json pnpm-lock.yaml .
RUN ["pnpm", "install", "--frozen-lockfile"]

COPY . .
RUN ["pnpm", "build"]

ENV BODY_SIZE_LIMIT Infinity
EXPOSE 3000
ENTRYPOINT ["node", "build"]