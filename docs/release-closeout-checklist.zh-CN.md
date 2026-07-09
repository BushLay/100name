# 发布收尾检查清单

当仓库已经进入“停止扩功能，准备正式发布”的阶段时，使用这份清单完成最后收尾。
请和 [production-deployment.md](C:/Project/100name/docs/production-deployment.md)、[incident-handbook.md](C:/Project/100name/docs/incident-handbook.md) 一起配合使用。

## 1. 本地绿灯状态

在仓库根目录运行：

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

只有四条命令全部成功，才进入发布阶段。

## 2. 生产环境必填配置

上线前确认部署平台里已经配置：

- `NODE_ENV=production`
- `NEXT_PUBLIC_SITE_URL`
- `NAME100_STORE_DRIVER=postgres`
- `DATABASE_URL`
- `NAME100_ADMIN_SECRET`
- `NAME100_RATE_LIMIT_DRIVER=postgres`
- `NAME100_ALERT_WEBHOOK_URL`
- `NAME100_EMAIL_WEBHOOK_URL`
- `NAME100_EMAIL_EVENT_WEBHOOK_SECRET`
- `NAME100_EMAIL_FROM`
- `NAME100_BACKUP_DIR`
- `NAME100_RESTORE_DATABASE_URL`

同时确认以下保留策略不是默认乱填，而是你有意设置的：

- `NAME100_MAGIC_LINK_RETENTION_DAYS`
- `NAME100_EMAIL_DELIVERY_EVENT_RETENTION_DAYS`
- `NAME100_OPERATIONAL_REPORT_RETENTION_DAYS`

## 3. 数据库与发布就绪检查

在已经加载生产环境变量的可信终端里运行：

```powershell
npm.cmd run db:status
npm.cmd run release:readiness
```

只要其中任何一条失败，就不要继续发布。

## 4. 部署后的运维验证

对已部署环境运行：

```powershell
npm.cmd run ops:readiness-check
npm.cmd run ops:daily-report
npm.cmd run ops:alert-drill
```

确认三条命令全部成功。

## 5. 管理后台验证

打开 `/admin`，确认：

- 健康状态和 readiness 摘要可以正常加载
- 定时任务新鲜度卡片状态符合预期
- 最近 cleanup、alert、readiness 历史可见
- 没有意外的高严重级别可疑活动标记

打开 `/admin/history`，确认：

- incident 时间线可以正常加载
- 归档的 ops report 可以正常加载
- 分享链接和保存视图功能正常

## 6. 用户侧冒烟测试

确认线上站点至少能完成以下流程：

- open 模式可以打开并提交有效猜测
- daily 模式可以打开当天题目
- leaderboard 页面可以正常加载
- 全新浏览器会话下 session bootstrap 正常
- identity claim 与 recovery 流程正常
- 邮件 magic link 的申请与验证流程正常

## 7. 运维演练确认

运行 `npm.cmd run ops:alert-drill` 之后，确认：

- 外部告警接收方收到了 `internal.alert.drill`
- `/admin` 里能看到这次 drill 的 operational alert 记录
- 如果 drill 结果是 failed 或 suppressed，必须先排查清楚再上线

运行 `npm.cmd run ops:nightly-maintenance` 之后，确认：

- `/admin` 里出现 cleanup 历史
- `/admin/history` 里出现新的 daily report
- scheduled job freshness 反映了最新运行结果

## 8. 备份与恢复

运行：

```powershell
npm.cmd run db:backup
npm.cmd run db:restore-drill -- .data/backups/name100-backup-YYYY-MM-DDTHH-MM-SS.sssZ.json
```

只有备份创建成功、恢复演练成功，才算真正具备发布条件。

## 9. 最终人工 Go/No-Go 问题

下面每一条都必须能回答“是”，否则先不要上线：

- 运维人员是否能用当前 secret 正常进入管理后台？
- 响应人员是否能在应用外部收到一次 drill 告警？
- 团队是否能说清楚 nightly maintenance 是怎么调度的？
- 团队是否真的能从最近一次备份里恢复？
- 上线第一周是否有明确的生产监控负责人？

## 10. 上线后尽快补的事项

这些不一定阻塞最基础的一次发布，但上线后应立即跟进：

- webhook 告警之外的外部监控面板
- 平台层面对调度任务失败的更强监控
- 告警演练和恢复演练的固定周期化
