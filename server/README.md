# Wildgrid ID 服务

Express + Node.js 内置 SQLite，只提供 `POST /api/player-id`，只接受 JSON `{ "deviceHash": "64 位十六进制 SHA-256" }`。服务返回 `{ "id": "000001" }`；同一哈希返回原 ID，大小写归一为小写。SQLite 的 `INTEGER PRIMARY KEY AUTOINCREMENT` 分配编号，`UNIQUE` 约束防止同设备重复注册；编号超过六位后继续增长。

实际部署在已配置 SSH 的 VPS 上，目录为 `/opt/wildgrid-id-server/`，数据库位于 `data/wildgrid.db`，独立 Node.js 24 位于 `node/`。现有系统 Node.js 18 保持不变。`wildgrid-id.service` 使用无登录权限的 `wildgrid-id` 用户运行，开机启动、崩溃重启，固定工作目录，只有数据目录可写。服务只监听 localhost 的 3001 端口，数据库没有任何静态 HTTP 路由。

依赖通过 `npm ci --omit=dev --ignore-scripts` 安装，systemd 单元来源为本目录的 `wildgrid-id.service`。源码和锁文件可以入库；生产数据库、运行时、SSH 密钥和 TLS 私钥不入库。

## 公网 HTTPS 部署

Nginx stream 使用 ssl_preread 接管 IPv4 和 IPv6 的公网 443。真实 REALITY SNI 转发到 Xray 的 localhost:10000；默认及无 SNI 流量转发到 Nginx 的 localhost:8443。HTTPS 后端仅将 POST `/api/player-id` 原路径代理到 localhost:3001，其他路径返回 404。客户端仍使用原公网 443，无需修改已有 VLESS 客户端。

Xray 由 3x-ui 管理，迁移保存在面板数据库中，原 runtime 配置只改变监听地址和端口。UUID、REALITY 密钥、shortId、flow、serverNames 和路由保持一致；面板 Hosts 公网端点元数据保留订阅导出的原地址与 443，继承全部握手参数。没有启用 PROXY protocol。原 HTTP 网站、下载站及 SSH 保持正常。

实际 Nginx 文件：`/etc/nginx/nginx.conf` 顶层引入 `/etc/nginx/stream-enabled/wildgrid-id.conf`；`/etc/nginx/conf.d/wildgrid-id-https.conf` 配置内部 HTTPS；原 `sites-available/receiver` 仅增加 ACME challenge location，webroot 为 `/var/www/wildgrid-acme`。公网地址只在必要代码和服务器配置中保存，README 不记录 IP。

Certbot 5.8 安装于 `/opt/certbot`，已通过 staging 签发测试并获得正式 Let's Encrypt IP 证书。证书使用 `shortlived` profile，位于 `/etc/letsencrypt/live/wildgrid-ip/`；Windows 和 Android 使用公共证书链校验。`certbot.timer` 开机启用，每日检查两次并加入随机延迟，调用官方 `certbot renew`。成功续签时执行 `/etc/letsencrypt/renewal-hooks/deploy/wildgrid-nginx.sh`：先 `nginx -t`，再 reload Nginx。官方 `renew --dry-run --run-deploy-hooks` 已通过；续签不停止 Xray 或公网 443。

切换前备份了 Nginx、Xray/面板数据库、systemd 配置和玩家数据库，并启用独立 systemd 自动回滚。内部真实 REALITY 握手、外部 VLESS REALITY Vision 代理流量和两端正式 HTTPS API 均通过后，才解除自动回滚。原备份留在 VPS 的 root 私有目录。原两条记录精确确认属于此前测试后才清理；真实玩家记录不再清理。

官方说明：https://letsencrypt.org/2026/03/11/shorter-certs-certbot
