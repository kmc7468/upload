FROM node:22-alpine
WORKDIR /usr/src/app

RUN apk update && \
    apk add --no-cache g++ make python3 py3-pip vips-dev vips-heif && \
    npm install --global pnpm@9

COPY .npmrc package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN sh patch/apply.sh && pnpm build

ENV BODY_SIZE_LIMIT=Infinity
EXPOSE 3000
ENTRYPOINT ["node", "build"]