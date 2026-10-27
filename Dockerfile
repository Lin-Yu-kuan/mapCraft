# 多階段構建：第 1 階段 - 建置
FROM node:22-alpine AS builder

WORKDIR /app

# 安裝 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 複製依賴宣告檔
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# 安裝所有依賴
RUN pnpm install --frozen-lockfile

# 複製專案原始碼
COPY . .

# 建置靜態檔案
RUN pnpm build

# 第 2 階段 - Nginx 靜態伺服器
FROM nginx:alpine

# 複製 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 複製建置產物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
