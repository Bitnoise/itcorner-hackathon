# Build with: docker build -t claude-code-sandbox -f agent-loop/Dockerfile .
# Optional — only used if you want to run the loop inside a container.

FROM node:20-bullseye-slim

# Tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    bash \
  && rm -rf /var/lib/apt/lists/*

# pnpm
RUN npm install -g pnpm@9

# Claude Code
RUN npm install -g @anthropic-ai/claude-code

# gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

CMD ["bash"]
