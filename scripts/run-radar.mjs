import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";

const root = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(root, "config/radar.json"), "utf8"));
const runDate = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const collectedAt = new Date().toISOString();
const outDir = path.join(root, "outputs", runDate);
await fs.mkdir(outDir, { recursive: true });

const signals = [];
const sourceStatus = [];
const clean = (value = "") => String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const id = (prefix, n) => `${prefix}-${runDate.replaceAll("-", "")}-${String(n).padStart(4, "0")}`;
const looksSyntheticOrOperationalNoise = (text) => /\b(gpt|agent orchestration|coordination source of truth|operator inbox|execution slot|task slot|canonical acronym|prompt injection)\b/i.test(text);

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function collectHackerNews() {
  const source = "Hacker News Ask";
  try {
    const ids = await fetchJson("https://hacker-news.firebaseio.com/v0/askstories.json");
    const items = await Promise.all(ids.slice(0, config.maxSignalsPerSource).map(x => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${x}.json`)));
    for (const item of items.filter(Boolean)) {
      const text = clean(`${item.title || ""} ${item.text || ""}`);
      if (!config.keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) continue;
      signals.push({ source_type: "community", source_name: source, source_url: `https://news.ycombinator.com/item?id=${item.id}`, title: clean(item.title), excerpt: clean(item.text).slice(0, 1200), engagement: Number(item.score || 0) + Number(item.descendants || 0), evidence_note: "Public discussion lead; not independently verified" });
    }
    sourceStatus.push({ source, method: "Official API", status: "collected", count: signals.filter(s => s.source_name === source).length });
  } catch (error) { sourceStatus.push({ source, method: "Official API", status: "skipped", error: error.message, count: 0 }); }
}

async function collectGitHub() {
  const source = "GitHub Issues";
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "market-friction-radar" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let count = 0;
  try {
    for (const query of config.githubQueries) {
      const data = await fetchJson(`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=comments&order=desc&per_page=10`, { headers });
      for (const item of data.items || []) {
        if (Number(item.comments || 0) > 200 || looksSyntheticOrOperationalNoise(`${item.title || ""} ${item.body || ""}`)) continue;
        signals.push({ source_type: "issue_tracker", source_name: source, source_url: item.html_url, title: clean(item.title), excerpt: clean(item.body).slice(0, 1200), engagement: Number(item.comments || 0), evidence_note: "Public engineering record; scope is repository-specific" });
        count++;
      }
    }
    sourceStatus.push({ source, method: "Official API", status: "collected", count });
  } catch (error) { sourceStatus.push({ source, method: "Official API", status: "skipped", error: error.message, count }); }
}

async function collectReddit() {
  const source = "Reddit";
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    sourceStatus.push({ source, method: "OAuth Data API", status: "skipped", error: "Missing Reddit credentials", count: 0 });
    return;
  }
  let count = 0;
  try {
    const auth = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
    const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": process.env.REDDIT_USER_AGENT || "market-friction-radar/0.1" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(20000) });
    if (!tokenResponse.ok) throw new Error(`OAuth HTTP ${tokenResponse.status}`);
    const { access_token } = await tokenResponse.json();
    for (const subreddit of config.subreddits) {
      const q = config.keywords.slice(0, 8).join(" OR ");
      const data = await fetchJson(`https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=comments&t=week&limit=10`, { headers: { Authorization: `Bearer ${access_token}`, "User-Agent": process.env.REDDIT_USER_AGENT || "market-friction-radar/0.1" } });
      for (const child of data.data?.children || []) {
        const p = child.data;
        signals.push({ source_type: "community", source_name: `Reddit r/${subreddit}`, source_url: `https://www.reddit.com${p.permalink}`, title: clean(p.title), excerpt: clean(p.selftext).slice(0, 1200), engagement: Number(p.score || 0) + Number(p.num_comments || 0), evidence_note: "Public self-report; requires independent verification" });
        count++;
      }
    }
    sourceStatus.push({ source, method: "OAuth Data API", status: "collected", count });
  } catch (error) { sourceStatus.push({ source, method: "OAuth Data API", status: "skipped", error: error.message, count }); }
}

async function collectWebWatch() {
  for (const entry of config.webWatch) {
    try {
      const response = await fetch(entry.url, { headers: { "User-Agent": "market-friction-radar/0.1" }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = clean((await response.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
      const lower = text.toLowerCase();
      const matches = config.keywords.filter(k => lower.includes(k.toLowerCase()));
      if (matches.length) signals.push({ source_type: "crowdfunding_discovery", source_name: entry.name, source_url: entry.url, title: `${entry.name} monitored page`, excerpt: `Matched terms: ${matches.join(", ")}`, engagement: 0, evidence_note: "Page-level lead only; campaign details require follow-up" });
      sourceStatus.push({ source: entry.name, method: "Public page watch", status: "collected", count: matches.length ? 1 : 0 });
    } catch (error) { sourceStatus.push({ source: entry.name, method: "Public page watch", status: "skipped", error: error.message, count: 0 }); }
  }
}

await Promise.all([collectHackerNews(), collectGitHub(), collectReddit(), collectWebWatch()]);
signals.sort((a, b) => b.engagement - a.engagement);
signals.forEach((s, i) => Object.assign(s, { signal_id: id("S", i + 1), collected_at: collectedAt }));

const clustersByKey = new Map();
for (const signal of signals) {
  const text = `${signal.title} ${signal.excerpt}`.toLowerCase();
  const key = config.keywords.find(k => text.includes(k.toLowerCase())) || "uncategorized friction";
  if (!clustersByKey.has(key)) clustersByKey.set(key, []);
  clustersByKey.get(key).push(signal);
}
const clusters = [...clustersByKey.entries()].map(([label, rows], i) => ({ cluster_id: id("C", i + 1), label, signal_ids: rows.map(r => r.signal_id), recurring_workflow: "待核实", affected_role: "待识别", payment_or_workaround_signal: label.includes("spreadsheet") || label.includes("manual") ? "Observed workaround language" : "待核实", contrary_evidence: "尚未检索", verification_status: "未经证实的商业摩擦线索" }));

async function generateWildConcepts() {
  if (!process.env.OPENAI_API_KEY || !clusters.length) return [];
  const schema = { type: "object", additionalProperties: false, properties: { concepts: { type: "array", items: { type: "object", additionalProperties: false, properties: { cluster_id: { type: "string" }, concept_title: { type: "string" }, transformation_operator: { type: "string", enum: ["反向", "跨域迁移", "极端约束", "责任倒置", "去除", "换付费者", "换时间"] }, concept_hypothesis: { type: "string" }, default_assumption_broken: { type: "string" }, why_it_might_work: { type: "string" }, disproof_condition: { type: "string" } }, required: ["cluster_id", "concept_title", "transformation_operator", "concept_hypothesis", "default_assumption_broken", "why_it_might_work", "disproof_condition"] } } }, required: ["concepts"] };
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-6-astra", store: false, instructions: "Generate bold but falsifiable commercial concept hypotheses from provisional pain clusters. Do not claim validation. Use structural inversion, cross-domain transfer, extreme constraints, and responsibility reversal. Return Chinese text.", input: JSON.stringify(clusters), text: { format: { type: "json_schema", name: "wild_concepts", strict: true, schema } } }), signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const body = await response.json();
  const outputText = body.output?.flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("") || "";
  return JSON.parse(outputText).concepts.map((c, i) => ({ concept_id: id("W", i + 1), ...c, evidence_boundary: "[创意假设] 未验证；不得回写为痛点证据" }));
}

let concepts = [];
try { concepts = await generateWildConcepts(); } catch (error) { sourceStatus.push({ source: "Wild Concepts", method: "OpenAI Responses API", status: "skipped", error: error.message, count: 0 }); }

await fs.writeFile(path.join(outDir, "signals.json"), JSON.stringify(signals, null, 2));
await fs.writeFile(path.join(outDir, "clusters.json"), JSON.stringify(clusters, null, 2));
await fs.writeFile(path.join(outDir, "wild-concepts.json"), JSON.stringify(concepts, null, 2));

const workbook = new ExcelJS.Workbook();
workbook.creator = "Market Friction Radar";
workbook.created = new Date();
const palette = { navy: "17365D", blue: "5B9BD5", light: "D9EAF7", amber: "FFF2CC", red: "FCE4D6", gray: "E7E6E6", white: "FFFFFF" };
function addSheet(name, columns) {
  const ws = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }));
  ws.getRow(1).font = { bold: true, color: { argb: palette.white } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.navy } };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.autoFilter = { from: "A1", to: ws.getRow(1).getCell(columns.length).address };
  ws.properties.defaultRowHeight = 18;
  return ws;
}
const summary = addSheet("Summary", [{header:"Metric",key:"metric",width:32},{header:"Value",key:"value",width:38}]);
summary.addRows([{metric:"Run date",value:runDate},{metric:"Collected at (UTC)",value:collectedAt},{metric:"Raw signals",value:signals.length},{metric:"Pain clusters",value:clusters.length},{metric:"Wild concepts",value:concepts.length},{metric:"Sources skipped",value:sourceStatus.filter(x=>x.status==="skipped").length},{metric:"Evidence boundary",value:"Signals and clusters are leads; Wild Concepts are unverified hypotheses."}]);
summary.eachRow((row, n) => { if (n > 1) row.height = 22; });
const pain = addSheet("Pain Signals", [{header:"Signal ID",key:"signal_id",width:20},{header:"Source",key:"source_name",width:24},{header:"Title",key:"title",width:48},{header:"Excerpt",key:"excerpt",width:72},{header:"Engagement",key:"engagement",width:14},{header:"Evidence note",key:"evidence_note",width:38},{header:"URL",key:"source_url",width:55}]);
pain.addRows(signals); pain.getColumn("source_url").eachCell((cell,row)=>{ if(row>1&&cell.value) cell.value={text:String(cell.value),hyperlink:String(cell.value)}; });
pain.eachRow((row, n) => { if (n > 1) row.height = 60; });
const clusterSheet = addSheet("Pain Clusters", [{header:"Cluster ID",key:"cluster_id",width:20},{header:"Label",key:"label",width:30},{header:"Signal IDs",key:"signal_ids",width:45},{header:"Recurring workflow",key:"recurring_workflow",width:30},{header:"Affected role",key:"affected_role",width:24},{header:"Workaround/payment signal",key:"payment_or_workaround_signal",width:34},{header:"Contrary evidence",key:"contrary_evidence",width:28},{header:"Verification status",key:"verification_status",width:36}]);
clusterSheet.addRows(clusters.map(c=>({...c,signal_ids:c.signal_ids.join(", ")})));
clusterSheet.eachRow((row, n) => { if (n > 1) row.height = 44; });
const conceptSheet = addSheet("Wild Concepts", [{header:"Concept ID",key:"concept_id",width:20},{header:"Cluster ID",key:"cluster_id",width:20},{header:"Concept title",key:"concept_title",width:40},{header:"Operator",key:"transformation_operator",width:18},{header:"[创意假设]",key:"concept_hypothesis",width:68},{header:"Assumption broken",key:"default_assumption_broken",width:48},{header:"Why it might work",key:"why_it_might_work",width:48},{header:"Disproof condition",key:"disproof_condition",width:48},{header:"Evidence boundary",key:"evidence_boundary",width:42}]);
conceptSheet.addRows(concepts.length ? concepts : [{concept_id:null,cluster_id:null,concept_title:"Automated ideation skipped",transformation_operator:null,concept_hypothesis:"OPENAI_API_KEY was not configured or no clusters were collected.",default_assumption_broken:null,why_it_might_work:null,disproof_condition:null,evidence_boundary:"No concept was generated."}]);
conceptSheet.eachRow((row, n) => { if (n > 1) row.height = 54; });
const sourcesSheet = addSheet("Sources", [{header:"Source",key:"source",width:32},{header:"Method",key:"method",width:24},{header:"Status",key:"status",width:16},{header:"Records",key:"count",width:12},{header:"Error",key:"error",width:56}]);
sourcesSheet.addRows(sourceStatus);
sourcesSheet.eachRow((row, n) => { if (n > 1) row.height = 26; });
for (const ws of workbook.worksheets) { ws.eachRow((row, n) => { if (n > 1) row.alignment = { vertical: "top", wrapText: true }; }); ws.eachRow(row => row.eachCell(cell => { cell.font = { name: "Arial", size: 10, bold: cell.font?.bold, color: cell.font?.color }; })); }
const reportPath = path.join(outDir, `market-friction-radar-${runDate}.xlsx`);
await workbook.xlsx.writeFile(reportPath);

let emailStatus = "skipped";
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.REPORT_TO_EMAIL) {
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: String(process.env.SMTP_SECURE || "true") === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  await transport.sendMail({ from: process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER, to: process.env.REPORT_TO_EMAIL, subject: `Market Friction Radar 周报 ${runDate}`, text: `本期收集 ${signals.length} 条信号、${clusters.length} 个待核实痛点簇、${concepts.length} 个 Wild Concepts。详见附件。`, attachments: [{ filename: path.basename(reportPath), path: reportPath }] });
  emailStatus = "sent";
}
console.log(JSON.stringify({ runDate, signals: signals.length, clusters: clusters.length, concepts: concepts.length, reportPath, emailStatus }, null, 2));
