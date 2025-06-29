FROM mcr.microsoft.com/devcontainers/javascript-node:20

RUN apt-get update && apt-get install -y \
    git curl vim \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm-check-updates prettier eslint typescript

USER node