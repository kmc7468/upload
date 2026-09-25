FROM node:22-alpine
WORKDIR /usr/src/app

RUN mkdir -p data && \
    apk add --no-cache g++ make python3 pkgconf vips-dev vips-heif && \
    npm install --global pnpm@12.6.0

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
# The prebuilt libvips omits HEIC/HEIF support; link sharp to Alpine's libvips.
ENV SHARP_FORCE_GLOBAL_LIBVIPS=1
RUN pnpm install --frozen-lockfile && \
    node -e "const sharp = require('sharp'); const vips = require('node:child_process').execFileSync('pkg-config', ['--modversion', 'vips-cpp'], { encoding: 'utf8' }).trim(); if (sharp.versions.vips !== vips || !sharp.format.heif.input.buffer) throw new Error('sharp must use system libvips with HEIF input')"

COPY . .
RUN pnpm build

ENV BODY_SIZE_LIMIT=Infinity
EXPOSE 3000
ENTRYPOINT ["node", "build"]
