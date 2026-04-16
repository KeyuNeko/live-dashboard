# Live Dashboard VPS 部署

以下示例按这组固定条件编写：

- 域名：`now.m1301.cyou`
- 应用：Docker Compose
- 反向代理：Nginx
- HTTPS：Let's Encrypt / Certbot
- 容器仅监听 VPS 本机 `127.0.0.1:3000`

## 1. DNS

先给 `now.m1301.cyou` 配置解析：

- `A` -> 你的 VPS 公网 IPv4
- 如果有 IPv6，再加 `AAAA`

建议先等待解析生效后再申请证书。

## 2. VPS 安装 Docker

以 Ubuntu 为例：

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
sudo systemctl enable --now nginx
```

## 3. 上传部署文件

把以下文件上传到 VPS，例如 `/opt/live-dashboard/`：

- `deploy/docker-compose.vps.yml`
- `deploy/.env.vps.example`
- `deploy/nginx/now.m1301.cyou.conf`

然后：

```bash
cd /opt/live-dashboard
cp .env.vps.example .env
```

编辑 `.env`，至少修改：

- `DEVICE_TOKEN_1`
- `HASH_SECRET`

示例生成：

```bash
openssl rand -hex 16
openssl rand -hex 32
```

`DEVICE_TOKEN_1` 格式：

```txt
token:device_id:device_name:platform
```

例如：

```txt
DEVICE_TOKEN_1=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:my-pc:My PC:windows
```

## 4. 启动应用

```bash
cd /opt/live-dashboard
docker compose -f docker-compose.vps.yml --env-file .env up -d
docker compose -f docker-compose.vps.yml ps
```

本机验证：

```bash
curl http://127.0.0.1:3000/api/health
```

预期返回：

```json
{"status":"ok", ...}
```

## 5. 配置 Nginx

复制站点配置：

```bash
sudo cp now.m1301.cyou.conf /etc/nginx/conf.d/now.m1301.cyou.conf
```

此时配置里引用了证书路径，所以建议先申请证书，或者先临时注释掉 443 server 块，只保留 80。

## 6. 申请 HTTPS 证书

确保 80 端口可从公网访问，然后执行：

```bash
sudo certbot --nginx -d now.m1301.cyou
```

成功后检查：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 放行端口

至少放行：

- `80/tcp`
- `443/tcp`

如果你只打算通过 Nginx 暴露服务，则不需要放行 `3000`。

## 8. 更新应用

```bash
cd /opt/live-dashboard
docker compose -f docker-compose.vps.yml pull
docker compose -f docker-compose.vps.yml --env-file .env up -d
```

## 9. 常用命令

查看状态：

```bash
docker compose -f docker-compose.vps.yml ps
```

查看日志：

```bash
docker compose -f docker-compose.vps.yml logs -f
```

重启：

```bash
docker compose -f docker-compose.vps.yml restart
```

停止：

```bash
docker compose -f docker-compose.vps.yml down
```

## 10. Agent 连接参数

应用地址：

```txt
https://now.m1301.cyou
```

Token：

```txt
使用 .env 中 DEVICE_TOKEN_1 冒号前面的 token
```
