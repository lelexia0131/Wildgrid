# Wildgrid ID 服务

Express + Node.js 内置 SQLite，只提供 `POST /api/player-id`，只接受 JSON `{ "deviceHash": "64 位十六进制 SHA-256" }`。服务返回 `{ "id": "000001" }`；同一哈希返回原 ID，大小写归一为小写。SQLite 的 `INTEGER PRIMARY KEY AUTOINCREMENT` 分配编号，`UNIQUE` 约束防止同设备重复注册；编号超过六位后继续增长。

实际部署在已配置 SSH 的 VPS 上，目录为 `/opt/wildgrid-id-server/`，数据库位于 `data/wildgrid.db`，独立 Node.js 24 位于 `node/`。现有系统 Node.js 18 保持不变。`wildgrid-id.service` 使用无登录权限的 `wildgrid-id` 用户运行，开机启动、崩溃重启，固定工作目录，只有数据目录可写。服务只监听 localhost 的 3001 端口，数据库没有任何静态 HTTP 路由。

依赖通过 `npm ci --omit=dev --ignore-scripts` 安装，systemd 单元来源为本目录的 `wildgrid-id.service`。源码和锁文件可以入库；生产数据库、运行时、SSH 密钥和 TLS 私钥不入库。

## 本轮部署边界

现有 Xray REALITY 占用公网 443。用户明确选择保留已有设施、暂缓公网 HTTPS，因此本轮不修改 Xray、Nginx 或防火墙规则，不申请证书、不启用 Certbot 续期或 reload hook。客户端预留的 HTTPS API 当前尚未可用，地址只在代码中配置。

后续只有在提供可用入口后才能启用公网 HTTPS。Let's Encrypt 官方支持 Certbot 5.4+ 的 IP webroot 申请，IP 证书使用 `shortlived` profile；需由 Nginx 提供 HTTP-01，使用 Certbot 官方 `renew` 定时机制，并通过 deploy hook 在成功续签后执行 `nginx -t && systemctl reload nginx`。原生客户端继续使用公共证书链校验。

官方说明：https://letsencrypt.org/2026/03/11/shorter-certs-certbot
