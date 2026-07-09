# Vercel 部署说明

这份说明是给 `Name 100` 项目部署到 Vercel 用的。
它基于当前仓库的真实结构整理，重点覆盖这个项目在 Vercel 上必须注意的点，而不是泛泛的 Next.js 教程。

## 1. 适合 Vercel 的运行方式

这个项目在 Vercel 上部署时，建议固定采用下面这组前提：

- 应用部署在 Vercel
- 数据存储使用 PostgreSQL
- `NAME100_STORE_DRIVER=postgres`
- `NAME100_RATE_LIMIT_DRIVER=postgres`
- 内部运维接口继续保留鉴权

不要在 Vercel 生产环境使用：

- `NAME100_STORE_DRIVER=file`
- 本地文件作为长期存储
- 依赖 Vercel 实例本地磁盘保存备份

## 2. 在 Vercel 里需要配置的环境变量

至少配置这些值：

```env
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://你的正式域名
NAME100_RELEASE_BASE_URL=https://你的正式域名
NAME100_STORE_DRIVER=postgres
DATABASE_URL=postgres://...
NAME100_ADMIN_SECRET=一个高强度随机值
CRON_SECRET=另一个高强度随机值
NAME100_RATE_LIMIT_DRIVER=postgres
NAME100_ALERT_WEBHOOK_URL=https://你的告警入口
NAME100_ALERT_LEVEL=error
NAME100_EMAIL_DELIVERY_DRIVER=webhook
NAME100_EMAIL_WEBHOOK_URL=https://你的邮件桥接服务
NAME100_EMAIL_EVENT_WEBHOOK_SECRET=单独的签名密钥
NAME100_EMAIL_FROM=noreply@你的域名
NAME100_MAGIC_LINK_TTL_MINUTES=15
NAME100_MAGIC_LINK_RETENTION_DAYS=30
NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS=90
NAME100_OPERATIONAL_REPORT_RETENTION_DAYS=180
NAME100_BACKUP_DIR=/tmp/name100-backups
NAME100_RESTORE_DATABASE_URL=postgres://...另一个恢复演练库
```

说明：

- `NAME100_ADMIN_SECRET` 用于人工或脚本访问内部运维接口。
- `CRON_SECRET` 用于 Vercel Cron 自动调用内部 cron 路由。
- `NAME100_BACKUP_DIR` 在 Vercel 上不能当长期备份仓库用，它只是脚本运行时的临时落点。
- 真正的长期备份应由可信机器或外部作业系统执行并转存到对象存储。

## 3. 仓库内已经准备好的 Vercel 支持

仓库已经包含：

- `vercel.json`
- `/api/internal/cron/readiness`
- `/api/internal/cron/daily-report`
- `CRON_SECRET` Bearer 鉴权支持

当前默认 Cron：

- 每天一次：`/api/internal/cron/readiness`
- 每天一次：`/api/internal/cron/daily-report`

说明：

- 当前仓库的 `vercel.json` 已经调整为兼容 Vercel Hobby 免费版。
- Vercel Hobby 账号不支持高于“每日一次”的 Cron 频率，所以这里没有再使用每小时探测。
- 如果你以后升级到 Pro，或者改用外部调度器，可以再把 readiness probe 提高到每小时一次。

## 4. 推荐部署步骤

### 第一步：把仓库连接到 Vercel

在 Vercel 中导入这个 Git 仓库，保持默认 Next.js Framework Preset 即可。

### 第二步：配置生产环境变量

把上面列出的环境变量填进 Vercel Project Settings。

### 第三步：先部署，再初始化数据库

首次部署完成后，在可信终端里执行：

```powershell
npm.cmd run db:status
npm.cmd run db:init
```

如果数据库已经初始化过，后续改为：

```powershell
npm.cmd run db:migrate
```

## 5. 首次部署后必须做的验证

在可信终端里运行：

```powershell
npm.cmd run release:readiness
npm.cmd run ops:readiness-check
npm.cmd run ops:daily-report
npm.cmd run ops:alert-drill
```

然后人工确认：

- `/admin` 能正常打开
- `/admin/history` 能正常打开
- 告警 drill 能送达外部接收端
- readiness probe 在 `/admin` 里留下记录
- daily report 在 `/admin/history` 里留下归档

## 6. 关于备份与恢复

这个项目可以部署在 Vercel，但不要把“在 Vercel 上跑备份脚本”理解成长期备份方案。

正确做法是：

1. 用可信机器执行 `npm.cmd run db:backup`
2. 把产物转存到真正长期保存的位置
3. 用 `npm.cmd run db:restore-drill` 对独立恢复库做演练

Vercel 更适合承载应用运行，不适合承担长期备份介质的角色。

## 7. 最后上线前建议

上线前请再过一遍：

- [release-closeout-checklist.zh-CN.md](./release-closeout-checklist.zh-CN.md)
- [release-closeout-checklist.md](./release-closeout-checklist.md)
- [production-deployment.md](./production-deployment.md)

如果你只想快速确认是否具备上线条件，优先执行中文版收尾清单即可。
