# This dockerfile generates a single-container application
# It copies build artifacts the from front-end image
# If you want to separate the front-end from the back-end, it should work as well

# Build SPA and PWA
FROM node:24 AS build-frontend
WORKDIR /frontend
# @quasar/app v1 requires node-ass, which takes 30 minutes to compile libsass in CI for arm64 and armv7
# So I prebuilt the binaries for arm64 and armv7
# @quasar/app v2 no longer uses this deprecated package, so this line will be removed in the future
ENV SASS_BINARY_SITE="https://github.com/umonaca/node-sass/releases/download"
RUN npm install -g @quasar/cli
ARG FRONTEND_VERSION="unstable"
# Workaround docker cache
# https://stackoverflow.com/questions/36996046/how-to-prevent-dockerfile-caching-git-clone
ADD https://api.github.com/repos/kikoeru-project/kikoeru-quasar/git/refs/heads/unstable /tmp/version.json
RUN git clone -b ${FRONTEND_VERSION} https://github.com/kikoeru-project/kikoeru-quasar.git .
RUN npm ci
RUN quasar build && quasar build -m pwa

FROM node:24-alpine AS build-backend
WORKDIR /usr/src/kikoeru

COPY package*.json ./
RUN npm ci

COPY . .
ARG FRONTEND_TYPE="pwa"
COPY --from=build-frontend /frontend/dist/${FRONTEND_TYPE} /usr/src/kikoeru/dist
RUN npm run build
RUN npm prune --omit=dev

# Final stage
FROM node:24-alpine
ENV IS_DOCKER=true
ENV KIKOERU_RUNTIME_DIR=/usr/src/kikoeru
WORKDIR /usr/src/kikoeru

COPY --from=build-backend /usr/src/kikoeru/build /usr/src/kikoeru/build
COPY --from=build-backend /usr/src/kikoeru/node_modules /usr/src/kikoeru/node_modules
COPY --from=build-backend /usr/src/kikoeru/package*.json /usr/src/kikoeru/
COPY --from=build-backend /usr/src/kikoeru/dist /usr/src/kikoeru/dist
COPY --from=build-backend /usr/src/kikoeru/static /usr/src/kikoeru/static
COPY --from=build-backend /usr/src/kikoeru/src/database/schema/migrations /usr/src/kikoeru/migrations

# Tini
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# 持久化
VOLUME [ "/usr/src/kikoeru/sqlite", "/usr/src/kikoeru/config", "/usr/src/kikoeru/covers"]

EXPOSE 8888
CMD [ "node", "build/server.js" ]
