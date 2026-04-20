#!/usr/bin/env python3
"""Generate a PDF of kataBased potential feed posts and send via Telegram.

Sources:
  - Manually crafted insider reviews (15 company + TradFi reviews)
  - Job signal scraper data (job_signals.db)
  - Twitter bookmarks (~/twitter-bookmarks.db)

Usage:
    python generate_feed_report.py
"""

import os
import sys
import json
import sqlite3
import textwrap
import urllib.request
from datetime import datetime, timezone

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
        Table, TableStyle, KeepTogether
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
except ImportError:
    print("pip install reportlab")
    sys.exit(1)

BOT_TOKEN = "8786285321:AAEXAuatwhOY7MtZvkPZZIrQxeWXgkojYss"
CHAT_ID   = "766292172"
PDF_PATH  = os.path.expanduser("~/claude/katabased_feed_report.pdf")

DB_JOBS    = os.path.join(os.path.dirname(__file__), "job_signals.db")
DB_TWEETS  = os.path.expanduser("~/twitter-bookmarks.db")

# ── Colour palette ─────────────────────────────────────────────────────────
NAVY    = colors.HexColor("#04050C")
AEGEAN  = colors.HexColor("#6B9FD4")
TERRA   = colors.HexColor("#D4845A")
OFFWHITE = colors.HexColor("#E8E8E8")
MUTED   = colors.HexColor("#9B9BB4")
RULE    = colors.HexColor("#1E2035")

# ── Feed posts — curated, insider-voiced ───────────────────────────────────

FEED_POSTS = [
    {
        "company": "Kraken",
        "tag": "INSIDER",
        "content": "support staff recruited as social engineering bait, called it a human layer problem. the IPO roadshow is a shitshow.",
        "category": "culture",
    },
    {
        "company": "World Liberty Financial",
        "tag": "INSIDER",
        "content": "depositors are trapped. freeze controls were known internally before they got exposed. nobody said anything.",
        "category": "company_review",
    },
    {
        "company": "Drift",
        "tag": "INSIDER",
        "content": "team wallet moved to Bybit during the active DPRK incident. not after. nobody on the post-mortem call had a straight answer for why.",
        "category": "management",
    },
    {
        "company": "Stripe / Bridge",
        "tag": "INSIDER",
        "content": "Bridge is a jurisdiction acquisition not a product acquisition. every MTL Stripe files is a door Circle can't close after them. nobody in crypto is watching this closely enough.",
        "category": "company_review",
    },
    {
        "company": "Robinhood",
        "tag": "INSIDER",
        "content": "AML and fraud compliance hires are pure overhead. engineers who stayed are coasting. building on Arb was the wrong call and the people who made it are still there.",
        "category": "culture",
    },
    {
        "company": "Coinbase",
        "tag": "INSIDER",
        "content": "institutional products has been bleeding senior engineers to competitors for three years. nobody left to build through all the bloat.",
        "category": "management",
    },
    {
        "company": "Fireblocks",
        "tag": "INSIDER",
        "content": "every TradFi firm going into tokenization ends up at Fireblocks. the integration takes longer than the deal. procurement owns your roadmap and nobody tells you that in the interview.",
        "category": "company_review",
    },
    {
        "company": "Ripple",
        "tag": "INSIDER",
        "content": "the ZK move is media fluff. the internal privacy rails are half-baked and the team knows it.",
        "category": "culture",
    },
    {
        "company": "TRM Labs",
        "tag": "INSIDER",
        "content": "We get paid by the exchanges we're supposed to flag. Our biggest contracts are with the same platforms generating the most suspicious volume.",
        "category": "management",
    },
    {
        "company": "Polymarket",
        "tag": "INSIDER",
        "content": "Kalshi spends triple on marketing and still can't close the gap with us. no KYC is the product. it's winning and it will keep winning.",
        "category": "company_review",
    },
    {
        "company": "Paxos",
        "tag": "INSIDER",
        "content": "PAXG has been audited but the audit cadence is quarterly and the gold market moves daily. you are trusting a regulated trust company to hold allocated bars in Brinks vaults and tell you about it four times a year.",
        "category": "management",
    },
    {
        "company": "Hyperliquid",
        "tag": "INSIDER",
        "content": "70% of onchain perps OI and that's not even the play. they're building data infrastructure that makes the exchange look like a front-end.",
        "category": "company_review",
    },
    {
        "company": "JPMorgan / Kinexys",
        "tag": "INSIDER",
        "content": "rebrand from Onyx to Kinexys was supposed to signal independence. still running on JPMorgan ticketing systems. more centralized than ever.",
        "category": "management",
    },
    {
        "company": "Wintermute",
        "tag": "INSIDER",
        "content": "We market make your token while running prop on the same book. you don't know what they're doing with your liquidity and that's by design.",
        "category": "management",
    },
]


# ── PDF builder ────────────────────────────────────────────────────────────

def build_pdf() -> str:
    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=letter,
        leftMargin=0.7*inch, rightMargin=0.7*inch,
        topMargin=0.7*inch, bottomMargin=0.7*inch,
    )

    styles = getSampleStyleSheet()

    S = {
        "title": ParagraphStyle("title",
            fontName="Helvetica-Bold", fontSize=20, textColor=OFFWHITE,
            spaceAfter=4, leading=24),
        "sub": ParagraphStyle("sub",
            fontName="Helvetica", fontSize=9, textColor=MUTED,
            spaceAfter=8),
        "tag": ParagraphStyle("tag",
            fontName="Helvetica-Bold", fontSize=7, textColor=NAVY,
            backColor=AEGEAN, leading=10),
        "company": ParagraphStyle("company",
            fontName="Helvetica-Bold", fontSize=13, textColor=AEGEAN,
            spaceBefore=6, spaceAfter=2),
        "post_title": ParagraphStyle("post_title",
            fontName="Helvetica-Bold", fontSize=10, textColor=OFFWHITE,
            leading=14, spaceAfter=4),
        "content": ParagraphStyle("content",
            fontName="Helvetica", fontSize=8.5, textColor=OFFWHITE,
            leading=13, spaceAfter=4),
        "signal": ParagraphStyle("signal",
            fontName="Helvetica-Oblique", fontSize=7.5, textColor=TERRA,
            leading=11, spaceAfter=2),
        "cat": ParagraphStyle("cat",
            fontName="Helvetica", fontSize=7, textColor=MUTED, spaceAfter=2),
        "section_hdr": ParagraphStyle("section_hdr",
            fontName="Helvetica-Bold", fontSize=11, textColor=TERRA,
            spaceBefore=14, spaceAfter=4),
        "stat_label": ParagraphStyle("stat_label",
            fontName="Helvetica", fontSize=8, textColor=MUTED, leading=11),
        "stat_val": ParagraphStyle("stat_val",
            fontName="Helvetica-Bold", fontSize=10, textColor=AEGEAN, leading=13),
    }

    story = []

    # ── Cover ───────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("kataBased", S["title"]))
    story.append(Paragraph(
        f"Feed Post Review — {datetime.now(timezone.utc).strftime('%B %d, %Y')}",
        S["sub"]
    ))
    story.append(Paragraph(
        "Potential seed content: insider-voiced reviews grounded in live job signals, "
        "breaking news, Twitter intel, and TradFi hiring patterns.",
        ParagraphStyle("intro", fontName="Helvetica", fontSize=9,
                       textColor=MUTED, leading=13, spaceAfter=10)
    ))

    # ── DB stats ────────────────────────────────────────────────────────────
    try:
        conn = sqlite3.connect(DB_JOBS)
        rows = conn.execute(
            "SELECT company, COUNT(*) as n FROM job_signals "
            "WHERE company NOT LIKE '_%' GROUP BY company ORDER BY n DESC LIMIT 8"
        ).fetchall()
        conn.close()
        if rows:
            story.append(HRFlowable(width="100%", thickness=1, color=RULE, spaceAfter=6))
            story.append(Paragraph("// LIVE JOB SIGNAL SNAPSHOT", S["section_hdr"]))
            tdata = [["COMPANY", "SIGNAL ROLES", "SOURCE"]]
            for r in rows:
                tdata.append([r[0], str(r[1]), "Greenhouse / Lever / Ashby"])
            t = Table(tdata, colWidths=[2.8*inch, 1.2*inch, 2.8*inch])
            t.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, 0), RULE),
                ("TEXTCOLOR",     (0, 0), (-1, 0), AEGEAN),
                ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",      (0, 0), (-1, -1), 7.5),
                ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
                ("TEXTCOLOR",     (0, 1), (-1, -1), OFFWHITE),
                ("ROWBACKGROUNDS",(0, 1), (-1, -1), [NAVY, colors.HexColor("#0A0B15")]),
                ("GRID",          (0, 0), (-1, -1), 0.25, RULE),
                ("TOPPADDING",    (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.15*inch))
    except Exception:
        pass

    # ── Posts ───────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=RULE, spaceAfter=6))
    story.append(Paragraph(
        f"// {len(FEED_POSTS)} POTENTIAL FEED POSTS", S["section_hdr"]
    ))
    story.append(Paragraph(
        "Each post below is draft content for kataBased. Review tone, specificity, and "
        "authenticity. Signal note shows the source data used.",
        ParagraphStyle("note", fontName="Helvetica", fontSize=8,
                       textColor=MUTED, leading=12, spaceAfter=10)
    ))

    for i, post in enumerate(FEED_POSTS, 1):
        tag = post.get("tag", "")
        tag_color = {
            "BREAKING / INSIDER": TERRA,
            "ACTIVE CRISIS": colors.HexColor("#D45A5A"),
            "BREACH / INSIDER": colors.HexColor("#D45A5A"),
            "JOB SIGNAL": AEGEAN,
            "TWITTER SIGNAL": colors.HexColor("#7B9FD4"),
            "REGULATORY SIGNAL": colors.HexColor("#7BD4A0"),
            "TRADFI SIGNAL": colors.HexColor("#D4C45A"),
        }.get(tag, MUTED)

        block = []
        block.append(HRFlowable(width="100%", thickness=0.5, color=RULE, spaceAfter=5))

        # Number + tag row
        tag_style = ParagraphStyle(f"tag_{i}",
            fontName="Helvetica-Bold", fontSize=7, textColor=NAVY,
            backColor=tag_color, leading=10, leftIndent=3, rightIndent=3)
        num_style = ParagraphStyle(f"num_{i}",
            fontName="Helvetica-Bold", fontSize=8, textColor=MUTED)

        block.append(Table(
            [[Paragraph(f"#{i:02d}", num_style),
              Paragraph(f" {tag} ", tag_style),
              Paragraph(f"[{post['category']}]", S["cat"])]],
            colWidths=[0.35*inch, 1.6*inch, 1.5*inch],
            style=[("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("TOPPADDING",(0,0),(-1,-1),0),
                   ("BOTTOMPADDING",(0,0),(-1,-1),3)]
        ))

        block.append(Paragraph(post["company"].upper(), S["company"]))
        block.append(Paragraph(f'"{post["title"]}"', S["post_title"]))
        block.append(Paragraph(post["content"], S["content"]))
        block.append(Paragraph(f"◆ SIGNAL: {post['signal']}", S["signal"]))
        block.append(Spacer(1, 0.08*inch))

        story.append(KeepTogether(block))

    # ── Twitter signal appendix ─────────────────────────────────────────────
    try:
        conn = sqlite3.connect(DB_TWEETS)
        tweets = conn.execute("""
            SELECT author_screen_name, full_text FROM headless_tweets
            WHERE (full_text LIKE '%crypto%' OR full_text LIKE '%blockchain%'
                OR full_text LIKE '%defi%' OR full_text LIKE '%hyperliquid%'
                OR full_text LIKE '%stablecoin%' OR full_text LIKE '%tokeniz%'
                OR full_text LIKE '%SEC%' OR full_text LIKE '%polymarket%')
            AND length(full_text) > 50
            ORDER BY rowid DESC LIMIT 12
        """).fetchall()
        conn.close()

        if tweets:
            story.append(HRFlowable(width="100%", thickness=1, color=RULE, spaceAfter=6))
            story.append(Paragraph("// TWITTER INTEL — RAW SIGNAL FEED", S["section_hdr"]))
            story.append(Paragraph(
                "Recent bookmarked tweets used as source material for review content above.",
                ParagraphStyle("tnote", fontName="Helvetica", fontSize=8,
                               textColor=MUTED, leading=12, spaceAfter=8)
            ))
            for author, text in tweets:
                short = text[:220].replace("\n", " ").strip()
                if len(text) > 220:
                    short += "…"
                handle = f"@{author}" if author and author != "unknown" else "[@bookmark]"
                story.append(Paragraph(
                    f'<font color="#6B9FD4"><b>{handle}</b></font>  '
                    f'<font color="#9B9BB4">{short}</font>',
                    ParagraphStyle("tweet", fontName="Helvetica", fontSize=7.5,
                                   leading=11, spaceAfter=5, textColor=OFFWHITE)
                ))
    except Exception:
        pass

    # ── Footer ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.2*inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=RULE))
    story.append(Paragraph(
        "kataBased — κατάβασις — the descent  |  katabased.vercel.app  |  "
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("footer", fontName="Helvetica", fontSize=7, textColor=MUTED,
                       leading=10, spaceBefore=4, alignment=TA_CENTER)
    ))

    doc.build(story)
    return PDF_PATH


# ── Telegram send ───────────────────────────────────────────────────────────

def send_telegram(pdf_path: str, caption: str = ""):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
    boundary = "----KBBoundary"
    with open(pdf_path, "rb") as f:
        pdf_data = f.read()
    filename = os.path.basename(pdf_path)
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n{CHAT_ID}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n{caption}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="document"; '
        f'filename="{filename}"\r\nContent-Type: application/pdf\r\n\r\n'
    ).encode() + pdf_data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


if __name__ == "__main__":
    print("Building feed report PDF...")
    path = build_pdf()
    print(f"PDF: {path} ({os.path.getsize(path)//1024}KB)")
    print("Sending via Telegram...")
    result = send_telegram(path,
        caption=f"kataBased Feed Post Review — {datetime.now(timezone.utc).strftime('%B %d, %Y')}\n"
                f"{len(FEED_POSTS)} potential posts | job signals + news + Twitter intel")
    if result.get("ok"):
        print("Sent.")
    else:
        print(f"Telegram error: {result}")
