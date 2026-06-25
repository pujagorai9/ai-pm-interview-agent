"use client";
import { AssessmentReport, InterviewStage } from "@/lib/types";
import { reportToMarkdown, getExportFilename, downloadBlob } from "@/lib/export";

interface Props {
  report: AssessmentReport;
}

export default function ExportButtons({ report }: Props) {
  function exportMarkdown() {
    const md = reportToMarkdown(report);
    const filename = getExportFilename(report.metadata.stage as InterviewStage, "md");
    downloadBlob(md, filename, "text/markdown");
  }

  function exportJson() {
    const json = JSON.stringify(report, null, 2);
    const filename = getExportFilename(report.metadata.stage as InterviewStage, "json");
    downloadBlob(json, filename, "application/json");
  }

  return (
    <div className="row-wrap" style={{ gap: 10 }}>
      <button className="btn btn-outline" onClick={exportMarkdown}>
        ⬇ Download as Markdown
      </button>
      <button className="btn btn-outline" onClick={exportJson}>
        ⬇ Download as JSON
      </button>
    </div>
  );
}
