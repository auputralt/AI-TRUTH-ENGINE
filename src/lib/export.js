import { parseReport, aggregateConfidenceByCategory } from "./parser.jsx";

const SECTION_META = {
  truth: { icon: "🔍", title: "The Real Truth" },
  confidence: { icon: "📊", title: "Confidence Breakdown" },
  hidden: { icon: "⚠️", title: "Hidden Factors" },
  future: { icon: "🔮", title: "Future Predictions" },
  dissent: { icon: "⚡", title: "Agent Dissent" },
};

const SECTION_ORDER = ["truth", "confidence", "hidden", "future", "dissent"];

function buildExportData(results, question) {
  const { rawResponses, compiledReport, agentCount, timestamp } = results;
  const sections = parseReport(compiledReport);
  const categoryConfidence = aggregateConfidenceByCategory(rawResponses);
  const overallConfidence = categoryConfidence.length
    ? Math.round(categoryConfidence.reduce((s, c) => s + c.avgConfidence, 0) / categoryConfidence.length)
    : 0;
  const successCount = rawResponses.filter((r) => !r.error).length;

  return { sections, categoryConfidence, overallConfidence, agentCount, successCount, timestamp, question };
}

function appendReportToBody(bodyEl, d) {
  const h1 = bodyEl.ownerDocument.createElement("h1");
  h1.textContent = "Truth Report";
  bodyEl.appendChild(h1);

  const meta = bodyEl.ownerDocument.createElement("p");
  meta.textContent = `${new Date(d.timestamp).toLocaleString()} · ${d.agentCount} agents · ${d.successCount} successful · ${d.overallConfidence}% confidence`;
  bodyEl.appendChild(meta);

  const qBox = bodyEl.ownerDocument.createElement("div");
  const qLabel = bodyEl.ownerDocument.createElement("p");
  qLabel.textContent = "Question";
  const qText = bodyEl.ownerDocument.createElement("p");
  qText.textContent = d.question;
  qBox.appendChild(qLabel);
  qBox.appendChild(qText);
  bodyEl.appendChild(qBox);

  for (const key of SECTION_ORDER) {
    const sectionMeta = SECTION_META[key];
    const content = d.sections[key];

    const h2 = bodyEl.ownerDocument.createElement("h2");
    h2.textContent = `${sectionMeta.icon} ${sectionMeta.title}`;
    bodyEl.appendChild(h2);

    if (key === "confidence") {
      for (const cat of d.categoryConfidence) {
        const p = bodyEl.ownerDocument.createElement("p");
        p.textContent = `${cat.name} (${cat.agentCount} agents): ${cat.avgConfidence}%`;
        bodyEl.appendChild(p);
      }
    } else if (content) {
      const div = bodyEl.ownerDocument.createElement("div");
      div.style.whiteSpace = "pre-wrap";
      div.textContent = content;
      bodyEl.appendChild(div);
    } else {
      const p = bodyEl.ownerDocument.createElement("p");
      p.textContent = "This section was not generated.";
      bodyEl.appendChild(p);
    }
  }
}

export function exportAsMarkdown(results, question) {
  const d = buildExportData(results, question);

  let md = `# Truth Report\n\n`;
  md += `**Question:** ${d.question}\n\n`;
  md += `> ${new Date(d.timestamp).toLocaleString()} · ${d.agentCount} agents · ${d.successCount} successful · ${d.overallConfidence}% confidence\n\n`;
  md += `---\n\n`;

  for (const key of SECTION_ORDER) {
    const meta = SECTION_META[key];
    const content = d.sections[key];
    md += `## ${meta.title}\n\n`;

    if (key === "confidence") {
      for (const cat of d.categoryConfidence) {
        md += `- **${cat.name}** (${cat.agentCount} agents): **${cat.avgConfidence}%**\n`;
      }
    } else if (content) {
      md += `${content}\n`;
    } else {
      md += `*This section was not generated in the report.*\n`;
    }
    md += `\n`;
  }

  return md;
}

export function exportAsText(results, question) {
  const d = buildExportData(results, question);

  let txt = `TRUTH REPORT\n${"=".repeat(40)}\n\n`;
  txt += `Question: ${d.question}\n`;
  txt += `${new Date(d.timestamp).toLocaleString()} | ${d.agentCount} agents | ${d.successCount} successful | ${d.overallConfidence}% confidence\n\n`;

  for (const key of SECTION_ORDER) {
    const meta = SECTION_META[key];
    const content = d.sections[key];
    txt += `${"-".repeat(40)}\n${meta.title}\n${"-".repeat(40)}\n`;

    if (key === "confidence") {
      for (const cat of d.categoryConfidence) {
        txt += `  ${cat.name} (${cat.agentCount} agents): ${cat.avgConfidence}%\n`;
      }
    } else if (content) {
      txt += `${content}\n`;
    } else {
      txt += `This section was not generated.\n`;
    }
    txt += `\n`;
  }

  return txt;
}

export function exportAsPDF(results, question) {
  const d = buildExportData(results, question);
  const printWindow = window.open("", "_blank");
  const doc = printWindow.document;

  const head = doc.createElement("head");
  const metaEl = doc.createElement("meta");
  metaEl.setAttribute("charset", "utf-8");
  const title = doc.createElement("title");
  title.textContent = "Truth Report";
  head.appendChild(metaEl);
  head.appendChild(title);

  const style = doc.createElement("style");
  style.textContent = `body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;padding:48px;max-width:700px;margin:0 auto}`;
  head.appendChild(style);
  doc.documentElement.appendChild(head);

  appendReportToBody(doc.body, d);

  const script = doc.createElement("script");
  script.textContent = "window.onload=function(){window.print();}";
  doc.body.appendChild(script);
}

export function exportAsDOCX(results, question) {
  const md = exportAsMarkdown(results, question);
  const lines = md.split("\n");
  let html = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += "<br/>";
      continue;
    }
    if (trimmed.startsWith("# ")) {
      html += `<h1>${trimmed.slice(2)}</h1>`;
    } else if (trimmed.startsWith("## ")) {
      html += `<h2>${trimmed.slice(3)}</h2>`;
    } else if (trimmed.startsWith("> ")) {
      html += `<blockquote>${trimmed.slice(2)}</blockquote>`;
    } else if (trimmed === "---") {
      html += "<hr/>";
    } else if (trimmed.startsWith("- ")) {
      html += `<li>${trimmed.slice(2)}</li>`;
    } else {
      html += `<p>${trimmed}</p>`;
    }
  }

  const fullHTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Truth Report</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222;margin:1in;line-height:1.6}
h1{font-size:18pt;color:#111;border-bottom:2px solid #333;padding-bottom:4pt}
h2{font-size:14pt;color:#333;margin-top:18pt;border-bottom:1px solid #ccc;padding-bottom:3pt}
blockquote{border-left:3px solid #999;padding-left:10px;color:#666;font-size:10pt;margin-left:0}
ul{padding-left:18pt}li{margin-bottom:3pt}
</style></head><body>${html}</body></html>`;

  const blob = new Blob([fullHTML], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `truth-report-${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(results, question) {
  const md = exportAsMarkdown(results, question);
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `truth-report-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(results, question) {
  const text = exportAsText(results, question);
  return navigator.clipboard.writeText(text);
}
