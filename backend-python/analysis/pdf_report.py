from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from io import BytesIO
from datetime import datetime


RISK_COLORS = {
    "HIGH": colors.HexColor("#ef4444"),
    "MEDIUM": colors.HexColor("#f59e0b"),
    "LOW": colors.HexColor("#22c55e"),
}
RISK_BG = {
    "HIGH": colors.HexColor("#fef2f2"),
    "MEDIUM": colors.HexColor("#fffbeb"),
    "LOW": colors.HexColor("#f0fdf4"),
}


def _sanitize(text: str) -> str:
    """Replace characters not supported by reportlab's default fonts (e.g. ₹) with safe equivalents."""
    if not text:
        return text
    return text.replace("₹", "Rs. ").replace("—", "-").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')


def generate_risk_report_pdf(
    filename: str,
    overall_risk_score: float,
    risk_breakdown: dict,
    risky_clauses: list,
    summary: str,
) -> bytes:
    """
    Generate a polished PDF risk report.

    Returns raw PDF bytes (for streaming response).
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        fontSize=22, textColor=colors.HexColor("#0f172a"), spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#64748b"), spaceAfter=20,
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"],
        fontSize=14, textColor=colors.HexColor("#0f172a"),
        spaceBefore=18, spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#1e293b"), leading=15,
    )
    summary_style = ParagraphStyle(
        "SummaryItem", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#1e293b"), leading=15,
        leftIndent=10, spaceAfter=6,
    )
    clause_text_style = ParagraphStyle(
        "ClauseText", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#64748b"),
        leading=13, spaceAfter=4, fontName="Helvetica-Oblique",
    )
    clause_explanation_style = ParagraphStyle(
        "ClauseExplanation", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#1e293b"), leading=14,
    )

    story = []

    # ── Header ──────────────────────────────────────────────────────────────
    story.append(Paragraph("ClauseGuard Risk Report", title_style))
    story.append(Paragraph(
        f"Document: <b>{_sanitize(filename)}</b> &nbsp;|&nbsp; Generated: {datetime.now().strftime('%d %b %Y, %I:%M %p')}",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))

    # ── Risk Score Summary ────────────────────────────────────────────────────
    score_color = (
        RISK_COLORS["HIGH"] if overall_risk_score >= 60
        else RISK_COLORS["MEDIUM"] if overall_risk_score >= 30
        else RISK_COLORS["LOW"]
    )
    risk_label = "High Risk" if overall_risk_score >= 60 else "Medium Risk" if overall_risk_score >= 30 else "Low Risk"

    score_style = ParagraphStyle(
        "Score", parent=styles["Normal"],
        fontSize=28, textColor=score_color, fontName="Helvetica-Bold",
    )
    score_label_style = ParagraphStyle(
        "ScoreLabel", parent=styles["Normal"],
        fontSize=14, textColor=score_color, fontName="Helvetica-Bold", spaceBefore=4,
    )

    score_table_data = [
        [Paragraph(f"{int(overall_risk_score)}/100", score_style),
         Paragraph(risk_label, score_label_style),
         Paragraph(f"<b>{risk_breakdown.get('HIGH', 0)}</b> HIGH", ParagraphStyle("h", parent=body_style, textColor=RISK_COLORS["HIGH"])),
         Paragraph(f"<b>{risk_breakdown.get('MEDIUM', 0)}</b> MEDIUM", ParagraphStyle("m", parent=body_style, textColor=RISK_COLORS["MEDIUM"])),
         Paragraph(f"<b>{risk_breakdown.get('LOW', 0)}</b> LOW", ParagraphStyle("l", parent=body_style, textColor=RISK_COLORS["LOW"]))],
    ]
    score_table = Table(score_table_data, colWidths=[1.3*inch, 1.5*inch, 1.2*inch, 1.3*inch, 1.1*inch])
    score_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    story.append(Spacer(1, 16))
    story.append(score_table)

    # ── Summary ──────────────────────────────────────────────────────────────
    story.append(Paragraph("Contract Summary", section_style))
    for line in summary.split("\n"):
        line = line.strip()
        if line:
            line = line.lstrip("•-").strip()
            story.append(Paragraph(f"• {_sanitize(line)}", summary_style))

    # ── Risky Clauses ────────────────────────────────────────────────────────
    story.append(Paragraph(f"Risky Clauses ({len(risky_clauses)})", section_style))

    if not risky_clauses:
        story.append(Paragraph("No risky clauses detected.", body_style))
    else:
        for i, clause in enumerate(risky_clauses, 1):
            label = clause.get("risk_label", "LOW")
            category = _sanitize((clause.get("risk_category") or "general").replace("_", " ").title())
            page_num = clause.get("page_number", "—")
            text_snippet = _sanitize(clause.get("text", "")[:250])
            explanation = _sanitize(clause.get("risk_explanation", ""))

            badge_style = ParagraphStyle(
                "Badge", parent=styles["Normal"],
                fontSize=9, textColor=colors.white, fontName="Helvetica-Bold",
                alignment=1,
            )
            header_data = [[
                Paragraph(label, badge_style),
                Paragraph(f"{category} &nbsp;·&nbsp; Page {page_num}", ParagraphStyle("cat", parent=body_style, fontSize=10, textColor=colors.HexColor("#64748b"))),
            ]]
            header_table = Table(header_data, colWidths=[0.85*inch, 5.65*inch])
            header_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), RISK_COLORS[label]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (0, 0), 4),
                ("BOTTOMPADDING", (0, 0), (0, 0), 4),
                ("LEFTPADDING", (1, 0), (1, 0), 10),
            ]))

            clause_block = [
                header_table,
                Spacer(1, 6),
                Paragraph(f"&ldquo;{text_snippet}{'…' if len(clause.get('text', '')) > 250 else ''}&rdquo;", clause_text_style),
                Paragraph(f"Why this matters: {explanation}", clause_explanation_style),
            ]

            wrapper = Table([[c] for c in clause_block], colWidths=[6.5*inch])
            wrapper.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), RISK_BG[label]),
                ("BOX", (0, 0), (-1, -1), 0.75, RISK_COLORS[label]),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]))

            story.append(wrapper)
            story.append(Spacer(1, 10))

    # ── Footer ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Paragraph(
        "Generated by ClauseGuard — AI Legal Contract Analyzer. This report is for informational purposes only and does not constitute legal advice.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#94a3b8"), spaceBefore=8)
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()