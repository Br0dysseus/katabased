#!/usr/bin/env python3
"""Moggleangelo — kataBased Feed Post Review. Post + review side by side."""

import os, urllib.request, json
from datetime import datetime, timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    KeepTogether, Table, TableStyle
)

BOT_TOKEN = "8786285321:AAEXAuatwhOY7MtZvkPZZIrQxeWXgkojYss"
CHAT_ID   = "766292172"
PDF_PATH  = os.path.expanduser("~/claude/moggleangelo_review.pdf")

PAGE_BG  = colors.HexColor("#0D0F1A")
NAVY     = colors.HexColor("#04050C")
AEGEAN   = colors.HexColor("#4A8AC4")
TERRA    = colors.HexColor("#C8703A")
OFFWHITE = colors.HexColor("#E8E8E8")
MUTED    = colors.HexColor("#9B9BB4")
RULE     = colors.HexColor("#2A2D45")
CARD_BG  = colors.HexColor("#131520")
REVIEW_BG= colors.HexColor("#1A1D2E")
GREEN    = colors.HexColor("#3DA05A")
ORANGE   = colors.HexColor("#C8703A")
RED      = colors.HexColor("#B03030")
BLUE     = colors.HexColor("#3A6A9A")

# ── Posts (from generate_feed_report.py) ─────────────────────────────────
POSTS = {
    "Kraken":
        "support staff recruited as social engineering bait, called it a human layer "
        "problem. the IPO roadshow is a shitshow.",
    "World Liberty Financial":
        "depositors are trapped. freeze controls were known internally before they got "
        "exposed. nobody said anything.",
    "Drift":
        "team wallet moved to Bybit during the active DPRK incident. not after. nobody "
        "on the post-mortem call had a straight answer for why.",
    "Stripe / Bridge":
        "Bridge is a jurisdiction acquisition not a product acquisition. every MTL Stripe "
        "files is a door Circle can't close after them. nobody in crypto is watching this "
        "closely enough.",
    "Robinhood":
        "AML and fraud compliance hires are pure overhead. engineers who stayed are "
        "coasting. building on Arb was the wrong call and the people who made it are "
        "still there.",
    "Coinbase":
        "institutional products has been bleeding senior engineers to competitors for "
        "three years. nobody left to build through all the bloat.",
    "Fireblocks":
        "every TradFi firm going into tokenization ends up at Fireblocks. the integration "
        "takes longer than the deal. procurement owns your roadmap and nobody tells you "
        "that in the interview.",
    "Ripple":
        "the ZK move is media fluff. the internal privacy rails are half-baked and the "
        "team knows it.",
    "TRM Labs":
        "We get paid by the exchanges we're supposed to flag. Our biggest contracts are "
        "with the same platforms generating the most suspicious volume.",
    "Polymarket":
        "Kalshi spends triple on marketing and still can't close the gap with us. no KYC "
        "is the product. it's winning and it will keep winning.",
    "Paxos":
        "PAXG has been audited but the audit cadence is quarterly and the gold market "
        "moves daily. you are trusting a regulated trust company to hold allocated bars "
        "in Brinks vaults and tell you about it four times a year.",
    "Hyperliquid":
        "70% of onchain perps OI and that's not even the play. they're building data "
        "infrastructure that makes the exchange look like a front-end.",
    "JPMorgan / Kinexys":
        "rebrand from Onyx to Kinexys was supposed to signal independence. still running "
        "on JPMorgan ticketing systems. more centralized than ever.",
    "Wintermute":
        "We market make your token while running prop on the same book. you don't know "
        "what they're doing with your liquidity and that's by design.",
}

# ── Moggleangelo reviews ──────────────────────────────────────────────────
REVIEWS = [
    {
        "company": "Kraken",
        "verdict": "SHIP",
        "score": "8/10",
        "notes": "'human layer problem' is the right frame — opsec failure, not breach. "
                 "'IPO roadshow is a shitshow' earns it. Punchy. Ships as-is.",
        "edit": None,
    },
    {
        "company": "World Liberty Financial",
        "verdict": "SHIP",
        "score": "9/10",
        "notes": "Three sentences, three facts, all devastating. 'Nobody said anything' "
                 "is the closer. This is the format everything else should aspire to.",
        "edit": None,
    },
    {
        "company": "Drift",
        "verdict": "SHIP",
        "score": "10/10",
        "notes": "'Not after.' Two words that do all the work. The post-mortem line seals it. "
                 "Best post in the set. Don't touch it.",
        "edit": None,
    },
    {
        "company": "Stripe / Bridge",
        "verdict": "SHIP",
        "score": "9/10",
        "notes": "'Jurisdiction acquisition' is the sharpest reframe in the set. Circle "
                 "as the named loser makes it concrete. Ships.",
        "edit": None,
    },
    {
        "company": "Robinhood",
        "verdict": "SHIP",
        "score": "8/10",
        "notes": "'Engineers who stayed are coasting' is the specific detail that makes "
                 "this feel real. Arb accountability line is sharp. Good.",
        "edit": None,
    },
    {
        "company": "Coinbase",
        "verdict": "SHIP",
        "score": "7/10",
        "notes": "Clean and specific. 'Three years' commits to a claim. 'Nobody left to "
                 "build through all the bloat' lands. Minor: 'bloat' is slightly generic — "
                 "consider 'compliance layer' or 'legal overhead' for precision.",
        "edit": "Optional: swap 'bloat' for something more specific to Coinbase's actual org problem.",
    },
    {
        "company": "Fireblocks",
        "verdict": "SHIP",
        "score": "9/10",
        "notes": "'Procurement owns your roadmap and nobody tells you that in the interview' "
                 "is the line. Names the exact friction, places the blame correctly, sounds "
                 "like someone who found out the hard way. Ships.",
        "edit": None,
    },
    {
        "company": "Ripple",
        "verdict": "SHIP",
        "score": "8/10",
        "notes": "'Media fluff' + 'half-baked and the team knows it' — this is the version "
                 "the last draft needed. Specific claim, insider knowledge implied, no hedging. "
                 "Ships.",
        "edit": None,
    },
    {
        "company": "TRM Labs",
        "verdict": "SHIP",
        "score": "10/10",
        "notes": "First-person 'We' is the right call — it reads like a leak, not an "
                 "allegation. Conflict of interest stated plainly with zero editorializing. "
                 "Strongest structural post in the set alongside Drift.",
        "edit": None,
    },
    {
        "company": "Polymarket",
        "verdict": "SHIP",
        "score": "9/10",
        "notes": "'No KYC is the product' is a perfect line. Kalshi as the named competitor "
                 "makes it credible. Confident closer. Ships.",
        "edit": None,
    },
    {
        "company": "Paxos",
        "verdict": "SHIP",
        "score": "8/10",
        "notes": "The cadence contrast — quarterly audit vs daily gold market — is the "
                 "argument. 'Brinks vaults' grounds it in physical reality. Good rhythm. "
                 "Ships.",
        "edit": None,
    },
    {
        "company": "Hyperliquid",
        "verdict": "SHIP",
        "score": "9/10",
        "notes": "'That's not even the play' pivot is the best edit in the set. "
                 "Data infrastructure > exchange is the contrarian read most people miss. "
                 "Earns the confidence. Ships.",
        "edit": None,
    },
    {
        "company": "JPMorgan / Kinexys",
        "verdict": "SHIP",
        "score": "8/10",
        "notes": "'Still running on JPMorgan ticketing systems' is the line — it needs "
                 "no explanation. 'More centralized than ever' is a strong closer. Ships.",
        "edit": None,
    },
    {
        "company": "Wintermute",
        "verdict": "SHIP",
        "score": "9/10",
        "notes": "'That's by design' is the knife. First-person 'We' works here same as "
                 "TRM — reads like someone who was in the room. The prop/market-make "
                 "conflict is real and named directly. Ships.",
        "edit": None,
    },
]

VERDICT_COLORS = {
    "SHIP":   GREEN,
    "REVISE": ORANGE,
    "CUT":    RED,
}


def _dark_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.restoreState()


def build_pdf():
    doc = SimpleDocTemplate(
        PDF_PATH, pagesize=letter,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
        topMargin=0.65*inch, bottomMargin=0.65*inch,
    )

    W = letter[0] - 1.2*inch  # usable width

    def ps(name, **kw):
        defaults = {
            "h1":        dict(fontName="Helvetica-Bold", fontSize=18, textColor=OFFWHITE, spaceAfter=3, leading=22),
            "sub":       dict(fontName="Helvetica", fontSize=9, textColor=MUTED, spaceAfter=8),
            "section":   dict(fontName="Helvetica-Bold", fontSize=10, textColor=TERRA, spaceBefore=10, spaceAfter=5),
            "company":   dict(fontName="Helvetica-Bold", fontSize=11, textColor=AEGEAN, spaceAfter=3, leading=14),
            "post":      dict(fontName="Helvetica", fontSize=8.5, textColor=OFFWHITE, leading=13, spaceAfter=0),
            "label":     dict(fontName="Helvetica-Bold", fontSize=7, textColor=MUTED, spaceAfter=2, leading=9),
            "notes":     dict(fontName="Helvetica", fontSize=8.5, textColor=OFFWHITE, leading=13, spaceAfter=3),
            "edit":      dict(fontName="Helvetica-Oblique", fontSize=8, textColor=TERRA, leading=12, spaceAfter=0),
            "verdict":   dict(fontName="Helvetica-Bold", fontSize=8, textColor=NAVY, leading=10),
            "summary":   dict(fontName="Helvetica", fontSize=8.5, textColor=OFFWHITE, leading=13, spaceAfter=2),
            "footer":    dict(fontName="Helvetica", fontSize=7.5, textColor=MUTED, leading=11),
        }[name]
        defaults.update(kw)
        return ParagraphStyle(name + str(id(kw)), **defaults)

    story = []

    # ── Header ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.15*inch))
    story.append(Paragraph("kataBased — Moggleangelo Review", ps("h1")))
    story.append(Paragraph(
        f"{datetime.now(timezone.utc).strftime('%B %d, %Y')}  ·  14 posts  ·  "
        f"14 ship  ·  0 revise",
        ps("sub")
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=RULE, spaceAfter=8))

    # ── Summary ───────────────────────────────────────────────────────────
    story.append(Paragraph("// VERDICT SUMMARY", ps("section")))
    ship   = [r["company"] for r in REVIEWS if r["verdict"] == "SHIP"]
    revise = [r["company"] for r in REVIEWS if r["verdict"] == "REVISE"]
    story.append(Paragraph(f"<b><font color='#3DA05A'>SHIP ({len(ship)}):</font></b>  {', '.join(ship)}", ps("summary")))
    if revise:
        story.append(Paragraph(f"<b><font color='#C8703A'>REVISE ({len(revise)}):</font></b>  {', '.join(revise)}", ps("summary")))

    story.append(HRFlowable(width="100%", thickness=1, color=RULE, spaceBefore=8, spaceAfter=10))

    # ── Per-post cards ────────────────────────────────────────────────────
    story.append(Paragraph("// POST REVIEWS", ps("section")))

    col_w = (W - 0.15*inch) / 2  # two equal columns with small gap

    for r in REVIEWS:
        company  = r["company"]
        post_txt = POSTS.get(company, "(post not found)")
        verdict  = r["verdict"]
        vc       = VERDICT_COLORS.get(verdict, MUTED)

        # Left cell — the actual post
        left = [
            Paragraph(company, ps("company")),
            Paragraph("POST", ps("label")),
            Paragraph(post_txt, ps("post")),
        ]

        # Right cell — verdict + notes + edit note
        verdict_para = Paragraph(
            f"  {verdict} · {r['score']}  ",
            ParagraphStyle("vp", fontName="Helvetica-Bold", fontSize=8,
                           textColor=NAVY, backColor=vc, leading=11, spaceAfter=4)
        )
        right = [
            Paragraph("REVIEW", ps("label")),
            verdict_para,
            Paragraph(r["notes"], ps("notes")),
        ]
        if r.get("edit"):
            right.append(Paragraph(f"▸ {r['edit']}", ps("edit")))

        t = Table(
            [[left, right]],
            colWidths=[col_w, col_w],
            spaceBefore=0, spaceAfter=0,
        )
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (0, 0), CARD_BG),
            ("BACKGROUND",   (1, 0), (1, 0), REVIEW_BG),
            ("VALIGN",       (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",   (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LINEAFTER",    (0, 0), (0, 0), 1, RULE),
        ]))

        story.append(KeepTogether([t, Spacer(1, 4)]))

    # ── Footer ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(
        "kataBased  ·  Moggleangelo editorial pass  ·  feed v2",
        ps("footer")
    ))

    doc.build(story, onFirstPage=_dark_bg, onLaterPages=_dark_bg)
    return PDF_PATH


def send_pdf(path):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
    boundary = "----KB7MA4YWxkTrZu0gW"
    with open(path, "rb") as f:
        file_data = f.read()
    filename = os.path.basename(path)
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
        f"{CHAT_ID}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="caption"\r\n\r\n'
        f"Moggleangelo review v2 — post + review side by side\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="document"; filename="{filename}"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode() + file_data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("ok", False)


if __name__ == "__main__":
    print("Building PDF...")
    path = build_pdf()
    print(f"Written: {path}")
    ok = send_pdf(path)
    print("Sent." if ok else "Send failed.")
