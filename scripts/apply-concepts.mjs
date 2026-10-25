import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const root = fileURLToPath(new URL("..", import.meta.url));
const runDate = process.env.RUN_DATE;
if (!runDate) throw new Error("RUN_DATE is required (YYYY-MM-DD)");
const outDir = path.join(root, "outputs", runDate);
const concepts = JSON.parse(await fs.readFile(path.join(outDir, "wild-concepts.json"), "utf8"));
const reportPath = path.join(outDir, `market-friction-radar-${runDate}.xlsx`);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(reportPath);

const summary = workbook.getWorksheet("Summary");
for (let row = 2; row <= summary.rowCount; row++) {
  if (summary.getCell(row, 1).value === "Wild concepts") summary.getCell(row, 2).value = concepts.length;
}

const oldSheet = workbook.getWorksheet("Wild Concepts");
workbook.removeWorksheet(oldSheet.id);
const sheet = workbook.addWorksheet("Wild Concepts", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
sheet.columns = [
  {header:"Concept ID",key:"concept_id",width:20},
  {header:"Cluster ID",key:"cluster_id",width:20},
  {header:"Concept title",key:"concept_title",width:40},
  {header:"Operator",key:"transformation_operator",width:18},
  {header:"[创意假设]",key:"concept_hypothesis",width:68},
  {header:"Assumption broken",key:"default_assumption_broken",width:48},
  {header:"Why it might work",key:"why_it_might_work",width:48},
  {header:"Disproof condition",key:"disproof_condition",width:48},
  {header:"Evidence boundary",key:"evidence_boundary",width:42}
];
sheet.getRow(1).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "17365D" } };
sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
sheet.autoFilter = { from: "A1", to: "I1" };
for (const concept of concepts) {
  sheet.addRow({
    concept_id: concept.concept_id,
    cluster_id: concept.cluster_id,
    concept_title: concept.concept_title,
    transformation_operator: concept.transformation_operator,
    concept_hypothesis: concept.concept_hypothesis,
    default_assumption_broken: concept.default_assumption_broken,
    why_it_might_work: concept.why_it_might_work,
    disproof_condition: concept.disproof_condition,
    evidence_boundary: concept.evidence_boundary
  }).height = 70;
}
sheet.eachRow((row, n) => { if (n > 1) { row.alignment = { vertical: "top", wrapText: true }; row.eachCell(cell => { cell.font = { name: "Arial", size: 10 }; }); } });
await workbook.xlsx.writeFile(reportPath);
console.log(JSON.stringify({ reportPath, concepts: concepts.length }));
