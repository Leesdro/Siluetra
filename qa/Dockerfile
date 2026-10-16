# Same OS/fontconfig/Freetype image as the Actions job, plus the exact Node binary.
FROM mcr.microsoft.com/playwright:v1.64.0-noble@sha256:bc72a8df40831ded821e3cbc79c318c21b44d6e51dff9fd89ace7a8249c5b462
RUN curl -fsSLo /tmp/node.tar.xz https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz \
 && echo '00bbd05e306ea68b6e13e17360d0e2f680b493ef95f2fea1c4296ff7437530bc  /tmp/node.tar.xz' | sha256sum -c - \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
 && rm /tmp/node.tar.xz
WORKDIR /work
