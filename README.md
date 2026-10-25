# Market Friction Radar

一个独立的市场摩擦扫描与周报系统。它从公开社区、GitHub Issues、Reddit 和众筹发现页收集商业痛点信号，将证据层与 `Wild Concepts` 创意层分开，并生成 Excel 周报发送到指定邮箱。

## 输出目录

```text
data/
├── 01-raw-signals/
├── 02-pain-clusters/
└── 03-wild-concepts/
outputs/YYYY-MM-DD/
├── signals.json
├── clusters.json
├── wild-concepts.json
└── market-friction-radar-YYYY-MM-DD.xlsx
```

## 本地运行

```bash
npm install
cp .env.example .env
npm run radar
```

Node 不会自动读取 `.env`。本地测试时请先在终端导出所需变量，或使用你信任的环境变量加载工具。

即使未配置 OpenAI 或邮件，扫描和 Excel 输出仍会运行；对应步骤会明确标记为 skipped。

## 每周自动运行

GitHub Actions 默认在每周一 09:00（新加坡时间，UTC+8）执行，也支持手动触发。定时表达式使用 UTC，因此仓库中的 cron 是周一 01:00 UTC。

在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 配置：

### Secrets

- `OPENAI_API_KEY`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `REPORT_TO_EMAIL`
- `REPORT_FROM_EMAIL`

### Variables

- `OPENAI_MODEL`：默认 `gpt-6-astra`
- `REDDIT_USER_AGENT`
- `SMTP_PORT`：通常为 `465`
- `SMTP_SECURE`：通常为 `true`

不要把密码、API Key 或收件邮箱提交到仓库。

## Excel 内容

- `Summary`：运行日期、信号数、聚类数、创意数和跳过来源。
- `Pain Signals`：原始信号、摘录、互动量、证据边界与来源链接。
- `Pain Clusters`：临时聚类、工作流、角色、反证和验证状态。
- `Wild Concepts`：反向、跨域、极端约束等未经验证的创意假设。
- `Sources`：每个来源的访问方式、状态、记录数和错误。

## 证据边界

点赞、评论、众筹金额和模型生成内容都不等于问题已被验证。所有创意与原始证据分开保存，并带有可证伪条件。
