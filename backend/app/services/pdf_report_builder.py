import io
import math
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class SimplePDFCanvas:
    """
    Lightweight, dependency-free, high-fidelity PDF 1.4 document builder.
    Constructs compliant multi-page PDF files with tables, headers, footers,
    typography, and vector graphics.
    """

    def __init__(self, page_width: float = 612.0, page_height: float = 792.0):
        self.width = page_width
        self.height = page_height
        self.margin_left = 40.0
        self.margin_right = 40.0
        self.margin_top = 45.0
        self.margin_bottom = 45.0

        self.pages: List[bytearray] = []
        self.current_page = bytearray()
        self.current_y = self.height - self.margin_top

    def new_page(self):
        if len(self.current_page) > 0 or len(self.pages) == 0:
            if len(self.current_page) > 0:
                self.pages.append(self.current_page)
            self.current_page = bytearray()
            self.current_y = self.height - self.margin_top

    def _escape(self, text: str) -> str:
        if text is None:
            return ""
        return (
            str(text)
            .replace("\\", "\\\\")
            .replace("(", "\\(")
            .replace(")", "\\)")
            .encode("latin-1", "replace")
            .decode("latin-1")
        )

    def draw_text(
        self,
        text: str,
        x: float,
        y: float,
        font: str = "F1",
        size: float = 10.0,
        r: float = 0.0,
        g: float = 0.0,
        b: float = 0.0,
    ):
        escaped = self._escape(text)
        cmd = f"BT /{font} {size:.1f} Tf {r:.3f} {g:.3f} {b:.3f} rg {x:.1f} {y:.1f} Td ({escaped}) Tj ET\n"
        self.current_page.extend(cmd.encode("latin-1"))

    def draw_rect(
        self,
        x: float,
        y: float,
        w: float,
        h: float,
        fill_r: Optional[float] = None,
        fill_g: Optional[float] = None,
        fill_b: Optional[float] = None,
        stroke_r: Optional[float] = None,
        stroke_g: Optional[float] = None,
        stroke_b: Optional[float] = None,
        stroke_w: float = 1.0,
    ):
        cmd = ""
        if fill_r is not None and fill_g is not None and fill_b is not None:
            cmd += f"{fill_r:.3f} {fill_g:.3f} {fill_b:.3f} rg "
        if stroke_r is not None and stroke_g is not None and stroke_b is not None:
            cmd += f"{stroke_r:.3f} {stroke_g:.3f} {stroke_b:.3f} RG {stroke_w:.1f} w "

        cmd += f"{x:.1f} {y:.1f} {w:.1f} {h:.1f} re "
        if fill_r is not None and stroke_r is not None:
            cmd += "B\n"
        elif fill_r is not None:
            cmd += "f\n"
        elif stroke_r is not None:
            cmd += "S\n"
        else:
            cmd += "n\n"

        self.current_page.extend(cmd.encode("latin-1"))

    def draw_line(
        self,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        r: float = 0.5,
        g: float = 0.5,
        b: float = 0.5,
        width: float = 1.0,
    ):
        cmd = f"{r:.3f} {g:.3f} {b:.3f} RG {width:.1f} w {x1:.1f} {y1:.1f} m {x2:.1f} {y2:.1f} l S\n"
        self.current_page.extend(cmd.encode("latin-1"))

    def check_space(self, needed_height: float):
        if self.current_y - needed_height < self.margin_bottom:
            self.new_page()

    def build_pdf(self) -> bytes:
        if len(self.current_page) > 0:
            self.pages.append(self.current_page)

        total_pages = max(1, len(self.pages))

        # Add headers and footers to each page (except cover page 1)
        for idx, page in enumerate(self.pages):
            page_num = idx + 1
            if page_num > 1:
                # Header
                header_text = "LUNAVISTA — Lunar Mission Decision Report"
                page.extend(
                    f"BT /F2 8.0 Tf 0.45 0.55 0.65 rg 40.0 {self.height - 30.0:.1f} Td ({self._escape(header_text)}) Tj ET\n".encode()
                )
                page.extend(
                    f"0.80 0.85 0.90 RG 0.5 w 40.0 {self.height - 35.0:.1f} m {self.width - 40.0:.1f} {self.height - 35.0:.1f} l S\n".encode()
                )

                # Footer
                footer_left = "OFFICIAL USE • NOT CERTIFIED AS LANDING SAFETY SYSTEM"
                page.extend(
                    f"BT /F1 7.5 Tf 0.50 0.55 0.60 rg 40.0 28.0 Td ({self._escape(footer_left)}) Tj ET\n".encode()
                )
                footer_right = f"Page {page_num} of {total_pages}"
                page.extend(
                    f"BT /F2 8.0 Tf 0.30 0.35 0.45 rg {self.width - 95.0:.1f} 28.0 Td ({self._escape(footer_right)}) Tj ET\n".encode()
                )
                page.extend(
                    f"0.80 0.85 0.90 RG 0.5 w 40.0 38.0 m {self.width - 40.0:.1f} 38.0 l S\n".encode()
                )

        # Assemble PDF 1.4 Object Structure
        pdf = bytearray()
        pdf.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]

        def write_obj(content: bytes):
            offsets.append(len(pdf))
            pdf.extend(content)
            pdf.extend(b"\n")

        # Fonts: F1 = Helvetica, F2 = Helvetica-Bold, F3 = Courier
        font1_obj_num = 3
        font2_obj_num = 4
        font3_obj_num = 5
        first_page_obj_num = 6

        # Reserve page object numbers
        # Each page has a Page object and a Contents stream object
        # Page i: obj num = first_page_obj_num + i*2
        # Stream i: obj num = first_page_obj_num + i*2 + 1
        page_obj_nums = [first_page_obj_num + i * 2 for i in range(total_pages)]

        # 1 0 obj: Catalog
        write_obj(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj")

        # 2 0 obj: Pages
        kids_str = " ".join(f"{p} 0 R" for p in page_obj_nums)
        write_obj(f"2 0 obj\n<< /Type /Pages /Kids [{kids_str}] /Count {total_pages} >>\nendobj".encode())

        # Fonts
        write_obj(b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj")
        write_obj(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj")
        write_obj(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj")

        # Page and Stream Objects
        for idx, page_data in enumerate(self.pages):
            page_obj = page_obj_nums[idx]
            stream_obj = page_obj + 1

            resources = (
                f"<< /Font << /F1 {font1_obj_num} 0 R /F2 {font2_obj_num} 0 R /F3 {font3_obj_num} 0 R >> "
                f"/ProcSet [/PDF /Text /ImageB /ImageC] >>"
            )
            write_obj(
                f"{page_obj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.width} {self.height}] "
                f"/Contents {stream_obj} 0 R /Resources {resources} >>\nendobj".encode()
            )

            stream_len = len(page_data)
            stream_bytes = (
                f"{stream_obj} 0 obj\n<< /Length {stream_len} >>\nstream\n".encode()
                + page_data
                + b"\nendstream\nendobj"
            )
            write_obj(stream_bytes)

        # Cross-reference table
        xref_offset = len(pdf)
        pdf.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
        for off in offsets[1:]:
            pdf.extend(f"{off:010d} 00000 n \n".encode())

        pdf.extend(
            f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode()
        )
        return bytes(pdf)


def generate_mission_decision_report_pdf(report_data: Dict[str, Any]) -> bytes:
    """
    Renders a comprehensive, publication-grade Mission Decision Report in PDF 1.4 format.
    Renders all 12 canonical technical sections with clean tables, metadata, and disclaimers.
    """
    canvas = SimplePDFCanvas(page_width=612.0, page_height=792.0)

    title = report_data.get("title", "LUNAVISTA Lunar Mission Decision Report")
    mission_name = report_data.get("mission_name", "Artemis Lunar Surface Assessment")
    report_id = report_data.get("id", "REP-UNKNOWN")
    created_at = report_data.get("created_at_iso", datetime.now(timezone.utc).isoformat())[:19].replace("T", " ")
    org = report_data.get("author_organization", "LUNAVISTA Mission Planning Directorate")
    profile = report_data.get("profile_snapshot", {})
    sections = report_data.get("sections", [])
    disclaimers = report_data.get("scientific_disclaimers", [])

    # =========================================================================
    # PAGE 1: COVER PAGE
    # =========================================================================
    canvas.draw_rect(0, 0, 612, 792, fill_r=0.03, fill_g=0.06, fill_b=0.12)  # Space navy background

    # Title header banner
    canvas.draw_rect(40, 520, 532, 210, fill_r=0.06, fill_g=0.11, fill_b=0.22, stroke_r=0.2, stroke_g=0.35, stroke_b=0.55, stroke_w=1.5)
    canvas.draw_text("LUNAVISTA", 60, 690, font="F2", size=24, r=0.25, g=0.75, b=1.0)
    canvas.draw_text("LUNAR LANDING SITE NAVIGATOR & DECISION SUPPORT SYSTEM", 60, 672, font="F2", size=8.5, r=0.6, g=0.75, b=0.9)
    canvas.draw_line(60, 660, 550, 660, r=0.25, g=0.45, b=0.70, width=1.0)

    canvas.draw_text("MISSION DECISION ANALYSIS REPORT", 60, 635, font="F2", size=15, r=1.0, g=1.0, b=1.0)
    canvas.draw_text(title[:60], 60, 612, font="F1", size=13, r=0.85, g=0.90, b=0.98)
    canvas.draw_text(f"Mission: {mission_name}", 60, 590, font="F2", size=11, r=0.3, g=0.85, b=0.6)
    canvas.draw_text(f"Report ID: {report_id}  •  Template: LUNAVISTA-REP-2026.1", 60, 570, font="F1", size=9, r=0.65, g=0.75, b=0.85)
    canvas.draw_text(f"Published: {created_at} UTC  •  Author: {org}", 60, 552, font="F1", size=9, r=0.65, g=0.75, b=0.85)

    # Executive Metadata Summary Box
    canvas.draw_rect(40, 240, 532, 255, fill_r=0.05, fill_g=0.08, fill_b=0.16, stroke_r=0.15, stroke_g=0.25, stroke_b=0.40, stroke_w=1.0)
    canvas.draw_text("MISSION EVALUATION PROFILE SNAPSHOT", 60, 465, font="F2", size=10, r=0.35, g=0.75, b=1.0)
    canvas.draw_line(60, 455, 550, 455, r=0.2, g=0.3, b=0.45, width=0.5)

    prof_name = profile.get("name", "N/A")
    prof_type = profile.get("mission_type", "Robotic Lander")
    prof_dur = profile.get("duration_days", 3.0)
    prof_h = profile.get("observer_height_m", 2.0)
    prof_start = profile.get("start_timestamp_iso") or profile.get("intended_analysis_start_iso", "2026-10-04T12:00:00Z")
    prof_end = profile.get("end_timestamp_iso") or profile.get("intended_analysis_end_iso", "2026-10-07T12:00:00Z")

    canvas.draw_text(f"Profile Designation: {prof_name} (v{profile.get('version', 1)})", 60, 435, font="F1", size=9.5, r=0.9, g=0.9, b=0.9)
    canvas.draw_text(f"Mission Architecture: {prof_type.replace('_', ' ').title()}", 60, 415, font="F1", size=9.5, r=0.9, g=0.9, b=0.9)
    canvas.draw_text(f"Nominal Analysis Duration: {prof_dur:.2f} Earth Days ({prof_dur * 24:.1f} Hours)", 60, 395, font="F1", size=9.5, r=0.9, g=0.9, b=0.9)
    canvas.draw_text(f"Observer Sensor Height: {prof_h:.1f} meters above surface", 60, 375, font="F1", size=9.5, r=0.9, g=0.9, b=0.9)
    canvas.draw_text(f"Analysis Window: {prof_start} to {prof_end}", 60, 355, font="F1", size=9.5, r=0.9, g=0.9, b=0.9)

    # Compliance Summary
    total_cand = report_data.get("total_candidates_evaluated", 0)
    comp_cand = report_data.get("compliant_candidates_count", 0)
    non_comp = report_data.get("non_compliant_candidates_count", 0)
    indet_cand = report_data.get("indeterminate_candidates_count", 0)

    canvas.draw_text(f"Total Evaluated Candidates: {total_cand}", 60, 325, font="F2", size=9.5, r=1.0, g=1.0, b=1.0)
    canvas.draw_text(f"• Fully Compliant (All Hard Constraints Passed): {comp_cand}", 75, 305, font="F1", size=9, r=0.3, g=0.85, b=0.5)
    canvas.draw_text(f"• Non-Compliant (Failed >= 1 Hard Constraint): {non_comp}", 75, 288, font="F1", size=9, r=1.0, g=0.4, b=0.4)
    canvas.draw_text(f"• Indeterminate (Partial DEM / Unverified Constraints): {indet_cand}", 75, 271, font="F1", size=9, r=0.95, g=0.7, b=0.2)
    canvas.draw_text(f"• Recommended Automatic Winner: NONE (Human Decision Authority Reserved)", 75, 254, font="F2", size=9, r=0.6, g=0.7, b=0.8)

    # Cover disclaimer banner
    canvas.draw_rect(40, 80, 532, 135, fill_r=0.08, fill_g=0.05, fill_b=0.05, stroke_r=0.5, stroke_g=0.2, stroke_b=0.2, stroke_w=1.0)
    canvas.draw_text("CRITICAL SCIENTIFIC & OPERATIONAL NOTICE", 60, 195, font="F2", size=9.5, r=1.0, g=0.4, b=0.4)
    canvas.draw_line(60, 188, 550, 188, r=0.5, g=0.2, b=0.2, width=0.5)
    notice_text = (
        "This report is a transparent mission planning and decision support compilation. "
        "Calculations reflect user-specified preference models and geometric ephemeris/horizon simulations. "
        "Topographical and visibility metrics do NOT establish geotechnical bearing capacity, touchdown stability, "
        "or communications link budgets. Official landing site selection requires multi-agency engineering certification."
    )
    # Simple word wrap
    words = notice_text.split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 80:
            lines.append(" ".join(curr))
            curr = []
    if curr:
        lines.append(" ".join(curr))

    y_notice = 175
    for l in lines[:4]:
        canvas.draw_text(l, 60, y_notice, font="F1", size=7.8, r=0.85, g=0.75, b=0.75)
        y_notice -= 13

    # =========================================================================
    # PAGE 2: TABLE OF CONTENTS & EXECUTIVE SUMMARY
    # =========================================================================
    canvas.new_page()

    canvas.draw_text("TABLE OF CONTENTS", 40, canvas.current_y, font="F2", size=14, r=0.1, g=0.2, b=0.4)
    canvas.current_y -= 10
    canvas.draw_line(40, canvas.current_y, 572, canvas.current_y, r=0.7, g=0.75, b=0.85, width=1.0)
    canvas.current_y -= 18

    toc_items = [
        "Section 1 — Mission Cover & Executive Overview",
        "Section 2 — Executive Summary & Trade-off Synopsis",
        "Section 3 — Mission Profile & Requirements Definition",
        "Section 4 — Candidate Landing Sites & Geodetic Overview",
        "Section 5 — Candidate Screening & Hard Constraint Matrix",
        "Section 6 — Mission Window Planner & Celestial Temporal Analysis",
        "Section 7 — Terrain Suitability & Topographic Assessment",
        "Section 8 — Terrain Horizon & Topocentric Celestial Geometry",
        "Section 9 — Multi-Criteria Mission Trade-off Analysis",
        "Section 10 — Comprehensive Alternatives Comparison Matrix",
        "Section 11 — Uncertainty, Data Limitations & Epistemic Boundaries",
        "Section 12 — Final Findings & Human Decision Authority Checklist",
    ]

    for item in toc_items:
        canvas.draw_text(item, 50, canvas.current_y, font="F1", size=9, r=0.2, g=0.3, b=0.4)
        canvas.current_y -= 14

    canvas.current_y -= 15

    # =========================================================================
    # RENDER ALL 12 CANONICAL REPORT SECTIONS
    # =========================================================================
    for sec in sections:
        canvas.check_space(100)
        sec_num = sec.get("section_number", 1)
        sec_title = sec.get("title", f"Section {sec_num}")
        summary = sec.get("summary", "")
        tables = sec.get("tables", [])
        callouts = sec.get("callouts", [])
        discs = sec.get("disclaimers", [])

        # Section Header
        canvas.draw_rect(40, canvas.current_y - 18, 532, 24, fill_r=0.92, fill_g=0.95, fill_b=0.98, stroke_r=0.6, stroke_g=0.7, stroke_b=0.85, stroke_w=0.8)
        canvas.draw_text(f"SECTION {sec_num}: {sec_title.upper()}", 48, canvas.current_y - 12, font="F2", size=10.5, r=0.08, g=0.18, b=0.35)
        canvas.current_y -= 30

        # Section Summary Text
        if summary:
            words = summary.split()
            lines = []
            curr = []
            for w in words:
                curr.append(w)
                if len(" ".join(curr)) > 88:
                    lines.append(" ".join(curr))
                    curr = []
            if curr:
                lines.append(" ".join(curr))

            for l in lines:
                canvas.check_space(15)
                canvas.draw_text(l, 45, canvas.current_y, font="F1", size=8.5, r=0.15, g=0.2, b=0.25)
                canvas.current_y -= 12

            canvas.current_y -= 6

        # Callouts
        for c in callouts:
            canvas.check_space(35)
            canvas.draw_rect(45, canvas.current_y - 20, 522, 22, fill_r=0.97, fill_g=0.96, fill_b=0.90, stroke_r=0.8, stroke_g=0.7, stroke_b=0.4, stroke_w=0.5)
            canvas.draw_text(f"NOTE: {c[:95]}", 52, canvas.current_y - 13, font="F2", size=7.8, r=0.4, g=0.3, b=0.1)
            canvas.current_y -= 28

        # Tables
        for tbl in tables:
            tbl_title = tbl.get("title", "")
            headers = tbl.get("headers", [])
            rows = tbl.get("rows", [])

            if tbl_title:
                canvas.check_space(20)
                canvas.draw_text(tbl_title, 45, canvas.current_y, font="F2", size=9, r=0.15, g=0.25, b=0.4)
                canvas.current_y -= 14

            if headers and rows:
                col_count = len(headers)
                col_width = 522.0 / col_count

                # Header Row
                canvas.check_space(18)
                canvas.draw_rect(45, canvas.current_y - 14, 522, 16, fill_r=0.15, fill_g=0.25, fill_b=0.4)
                for c_idx, h in enumerate(headers):
                    x_cell = 45 + c_idx * col_width + 4
                    canvas.draw_text(str(h)[:16], x_cell, canvas.current_y - 10, font="F2", size=7.5, r=1.0, g=1.0, b=1.0)
                canvas.current_y -= 16

                # Data Rows
                for r_idx, r in enumerate(rows):
                    canvas.check_space(15)
                    bg = 0.96 if r_idx % 2 == 0 else 1.0
                    canvas.draw_rect(45, canvas.current_y - 12, 522, 13, fill_r=bg, fill_g=bg, fill_b=bg, stroke_r=0.85, stroke_g=0.85, stroke_b=0.85, stroke_w=0.3)
                    for c_idx, cell_val in enumerate(r[:col_count]):
                        x_cell = 45 + c_idx * col_width + 4
                        # Highlight statuses
                        str_val = str(cell_val)
                        if str_val in ("PASS", "COMPLIANT", "PARETO_OPTIMAL"):
                            canvas.draw_text(str_val[:16], x_cell, canvas.current_y - 9, font="F2", size=7.2, r=0.0, g=0.5, b=0.2)
                        elif str_val in ("FAIL", "NON_COMPLIANT", "DOMINATED"):
                            canvas.draw_text(str_val[:16], x_cell, canvas.current_y - 9, font="F2", size=7.2, r=0.7, g=0.1, b=0.1)
                        elif str_val in ("INDETERMINATE", "INCOMPARABLE_INCOMPLETE"):
                            canvas.draw_text(str_val[:16], x_cell, canvas.current_y - 9, font="F2", size=7.2, r=0.7, g=0.45, b=0.0)
                        else:
                            canvas.draw_text(str_val[:16], x_cell, canvas.current_y - 9, font="F1", size=7.2, r=0.2, g=0.2, b=0.2)
                    canvas.current_y -= 13

                canvas.current_y -= 10

        # Disclaimers
        for d in discs:
            canvas.check_space(18)
            canvas.draw_text(f"* {d[:100]}", 48, canvas.current_y, font="F1", size=7.2, r=0.5, g=0.4, b=0.4)
            canvas.current_y -= 11

        canvas.current_y -= 14

    # Final Technical Sign-Off Block
    canvas.check_space(100)
    canvas.draw_rect(40, canvas.current_y - 70, 532, 70, fill_r=0.95, fill_g=0.96, fill_b=0.98, stroke_r=0.7, stroke_g=0.75, stroke_b=0.85, stroke_w=1.0)
    canvas.draw_text("DECISION AUTHORITY SIGN-OFF & HUMAN REVIEW CHECKLIST", 50, canvas.current_y - 15, font="F2", size=9, r=0.1, g=0.2, b=0.35)
    canvas.draw_line(50, canvas.current_y - 20, 560, canvas.current_y - 20, r=0.7, g=0.75, b=0.85, width=0.5)
    canvas.draw_text("[  ] Lead Mission Planner Review Completed        Date: _______________    Signature: _______________________", 50, canvas.current_y - 36, font="F3", size=7.5, r=0.2, g=0.25, b=0.3)
    canvas.draw_text("[  ] Landing Site Hazard Review Completed         Date: _______________    Signature: _______________________", 50, canvas.current_y - 50, font="F3", size=7.5, r=0.2, g=0.25, b=0.3)
    canvas.draw_text("[  ] Mission Operations Directorate Concurrence   Date: _______________    Signature: _______________________", 50, canvas.current_y - 64, font="F3", size=7.5, r=0.2, g=0.25, b=0.3)

    return canvas.build_pdf()
