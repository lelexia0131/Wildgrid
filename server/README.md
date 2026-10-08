# Wildgrid ID 服务

Express + Node.js 内置 SQLite，只提供 `POST /api/player-id`，只接受 JSON `{ "deviceHash": "64 位十六进制 SHA-256" }`。服务返回 `{ "id": "000001" }`；同一哈希返回原 ID，大小写归一为小写。SQLite 的 `INTEGER PRIMARY KEY AUTOINCREMENT` 分配编号，`UNIQUE` 约束防止同设备重复注册；编号超过六位后继续增长。

新设备按滚动窗口限制为最近 1 分钟 10 人、1 小时 100 人、24 小时 300 人。成功注册的时间保存在 SQLite `registration_events` 表；`BEGIN IMMEDIATE` 事务内重新查设备、检查所有配额并写入玩家和注册记录。超限返回 HTTP 429 和秒数形式的 `Retry-After`，不插入玩家或消耗自增编号。已有设备查询不受注册配额影响。超过 24 小时的记录在注册时和每分钟自动清理，重启服务不会重置配额。

Windows 的 `player-id.json` 和 Android 的独立玩家 ID preferences 使用 `playerIdCacheVersion = 2`。旧缓存先丢弃，网络失败不会返回旧 ID；成功获取服务器 ID 后才保存新版本。设备哈希及其 v1 前缀不变，存档、地图和设置不迁移。后续更新直接使用 v2 缓存，重装仍按原设备哈希恢复；未更新客户端可能继续显示旧 ID。

实际部署在已配置 SSH 的 VPS 上，目录为 `/opt/wildgrid-id-server/`，数据库位于 `data/wildgrid.db`，独立 Node.js 24 位于 `node/`。现有系统 Node.js 18 保持不变。`wildgrid-id.service` 使用无登录权限的 `wildgrid-id` 用户运行，开机启动、崩溃重启，固定工作目录，只有数据目录可写。服务只监听 localhost 的 3001 端口，数据库没有任何静态 HTTP 路由。

依赖通过 `npm ci --omit=dev --ignore-scripts` 安装，systemd 单元来源为本目录的 `wildgrid-id.service`。源码和锁文件可以入库；生产数据库、运行时、SSH 密钥和 TLS 私钥不入库。

## 公网 HTTPS 部署

Nginx stream 使用 ssl_preread 接管 IPv4 和 IPv6 的公网 443。真实 REALITY SNI 转发到 Xray 的 localhost:10000；默认及无 SNI 流量转发到 Nginx 的 localhost:8443。HTTPS 后端仅将 POST `/api/player-id` 原路径代理到 localhost:3001，其他路径返回 404。客户端仍使用原公网 443，无需修改已有 VLESS 客户端。

Xray 由 3x-ui 管理，迁移保存在面板数据库中，原 runtime 配置只改变监听地址和端口。UUID、REALITY 密钥、shortId、flow、serverNames 和路由保持一致；面板 Hosts 公网端点元数据保留订阅导出的原地址与 443，继承全部握手参数。没有启用 PROXY protocol。原 HTTP 网站、下载站及 SSH 保持正常。

实际 Nginx 文件：`/etc/nginx/nginx.conf` 顶层引入 `/etc/nginx/stream-enabled/wildgrid-id.conf`；`/etc/nginx/conf.d/wildgrid-id-https.conf` 配置内部 HTTPS；原 `sites-available/receiver` 仅增加 ACME challenge location，webroot 为 `/var/www/wildgrid-acme`。公网地址只在必要代码和服务器配置中保存，README 不记录 IP。

本目录 `wildgrid-id-https.conf` 对应线上 HTTP 配置。仅 `/api/player-id` 启用原生 `limit_req`（全局 5 请求/秒、burst 20、nodelay）和 `limit_conn`（全局最多 20 个处理中请求），两者拒绝均返回 429。固定字符串作为全局键，不使用内部 127.0.0.1 做每 IP 限流。请求体最多 1KB，请求头/请求体读取超时 5 秒，代理连接超时 3 秒、发送超时 5 秒、读取超时 10 秒；stream、REALITY 和 PROXY protocol 不变。

Certbot 5.8 安装于 `/opt/certbot`，已通过 staging 签发测试并获得正式 Let's Encrypt IP 证书。证书使用 `shortlived` profile，位于 `/etc/letsencrypt/live/wildgrid-ip/`；Windows 和 Android 使用公共证书链校验。`certbot.timer` 开机启用，每日检查两次并加入随机延迟，调用官方 `certbot renew`。成功续签时执行 `/etc/letsencrypt/renewal-hooks/deploy/wildgrid-nginx.sh`：先 `nginx -t`，再 reload Nginx。官方 `renew --dry-run --run-deploy-hooks` 已通过；续签不停止 Xray 或公网 443。

2026-10-08 按明确授权重置玩家库：修改前使用 SQLite 在线备份并检查备份完整性，保留 Node 源码和 HTTP 配置备份于 VPS root 私有目录。先在隔离数据库验证保护并部署，再临时暂停 API、停止 Node，在事务中清空 `players`、删除其 `sqlite_sequence` 条目并清空注册配额，检查下一个编号为 1 后启动服务并恢复 API。保留数据库结构、权限及服务配置，不触及其他数据库。注册验证只使用隔离数据库，不在正式库生成假玩家。

官方说明：https://letsencrypt.org/2026/03/11/shorter-certs-certbot
