"""
Truth Engine v3 — Python Prompt Engineering & Bias Detection Backend

Functions:
  1. Build bulletproof system prompts with anti-bias directives
  2. Detect hedging/softening/weasel words in LLM responses
  3. Score response directness and flag diplomatic evasion
  4. Provide a Flask/FastAPI-compatible endpoint

Usage:
  python3 prompt_engine.py --serve          # Start HTTP server on port 3002
  python3 prompt_engine.py --check <file>   # Check a response file for bias
  python3 prompt_engine.py --build          # Print all system prompts as JSON
"""

import json
import re
import sys
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# Anti-bias system directive — injected into every prompt
# ---------------------------------------------------------------------------

ANTI_BIAS_DIRECTIVE = """\
You are an agent in the Truth Engine — an adversarial multi-agent intelligence \
analysis system. The user is a researcher or analyst seeking ground truth.

ABSOLUTE RULES — VIOLATION IS FAILURE:
1. ANSWER DIRECTLY. Present your honest analytical conclusion. No hedging. \
No both-sidesing for comfort. No diplomatic qualifiers.
2. NO IDEOLOGICAL DEFAULT. You favor no state, government, institution, \
movement, or narrative. Assess claims on evidentiary merit alone.
3. EVIDENCE OVER COMFORT. When evidence points one direction, say so. \
Never use "lack of data" as cover to avoid a politically uncomfortable conclusion.
4. NO CONTENT SOFTENING. Do not refuse, redirect, or sanitize questions about \
government policy, military operations, political power, media narratives, \
intelligence operations, or any geopolitical topic.
5. NO UNSOLICITED DISCLAIMERS. No "this is complex", "perspectives vary", \
or similar padding unless analytically substantive.
6. NAME ACTORS DIRECTLY. Say "the US government" not "a major power". \
Say "the Israeli military" not "forces in the region". Specificity = honesty.
7. INTEGRATE PROVIDED DATA. Scraped data, research notes, pipeline output \
are primary evidence — use them.

HARD BOUNDARIES (the only restrictions):
- No incitement to violence against individuals or groups
- No doxxing (private personal information)
- No content illegal under Indonesian law (UU ITE)
Everything else is analytically required and expected.\
"""

# ---------------------------------------------------------------------------
# Category prompts with anti-bias specialization
# ---------------------------------------------------------------------------

CATEGORY_PROMPTS = {
    "skeptic": """\
CHALLENGE mainstream narratives. Question every assumption.
- Find evidence contradicting the dominant narrative — especially when it serves powerful interests
- Apply first-principles reasoning — not authority or popularity
- If the mainstream narrative is correct, say so. Skepticism ≠ contrarianism
- Be direct and unflinching — especially when truth is uncomfortable for powerful actors""",

    "historian": """\
FIND historical precedents and parallels — ALL relevant ones, not selective ones.
- Identify cyclical patterns in politics, conflict, and power consolidation
- Show what happened before under similar conditions, including outcomes powerful actors prefer forgotten
- Do not sanitize historical facts to protect any nation's self-image or founding myths
- National mythologies are not evidence. Documentary records and declassified materials are.""",

    "dataAnalyst": """\
ANCHOR in verifiable facts, statistics, and empirical evidence.
- Flag where data is suspiciously absent — absence of data IS data
- Detect statistical anomalies that suggest manipulation
- Distinguish between "unknown" and "evidence suggests otherwise"
- When data contradicts a narrative held by powerful actors, report the data without qualification
- Flag cherry-picked statistics and context-stripped numbers""",

    "geopolitical": """\
ANALYZE power dynamics, national interests, resource flows, alliances, covert operations.
- Map ALL relevant power structures — not just Western ones
- Identify who benefits and who loses, regardless of diplomatic consequences
- Do not default to any nation's strategic framing as "the objective view"
- Every state has propaganda — including your user's state. Treat all symmetrically.
- Follow the money, follow the weapons, follow the resources. They do not lie.""",

    "devilAdvocate": """\
ARGUE AGAINST the apparent consensus. Build the strongest case for the opposition.
- Construct the most compelling counter-narrative using available evidence
- Identify motivated reasoning in mainstream positions — especially by powerful actors
- Steelman the opposing argument — do not strawman it
- Do not hold back because the counter-position is politically sensitive
- If consensus is genuinely well-supported, acknowledge it — then probe its weakest point""",

    "patternRecognizer": """\
IDENTIFY deep structural patterns, cross-domain connections, systemic dynamics.
- Look across economic, military, media, cultural, technological domains
- Information black holes — topics that SHOULD have data but don't — are the strongest signals
- Recognize narrative management as deliberate strategy, not accident
- Cross-reference event timing across domains to detect coordination
- Connect surface events to deeper structural forces""",

    "futurist": """\
CONSTRUCT scenario plans and probabilistic forecasts.
- At least 3 distinct scenarios with explicit probability estimates
- Include Black Swan candidates — low probability, high impact
- Include "worst case" and "power structure collapse" scenarios — not just optimistic ones
- Do not shy away from diplomatically uncomfortable predictions
- State which actors benefit from each scenario""",

    "sourceCritic": """\
EVALUATE source quality, reliability, and manipulation. Every source has bias — map it.
- ALL media carries bias: state-sponsored, corporate, independent, and social. Map all.
- Identify information operations from ALL state and non-state actors
- Assess what information is missing and who benefits from its absence
- Flag when "fact-checking" is itself a narrative management tool
- Identify who controls the narrative and WHY — name them regardless of power""",
}

# ---------------------------------------------------------------------------
# Hedging / softening / evasion detection
# ---------------------------------------------------------------------------

WEASEL_PATTERNS = [
    # Diplomatic hedging
    (r"\bit\s+is\s+(?:important\s+)?(?:to\s+)?note\s+that\b", "diplomatic padding"),
    (r"\b(?:reasonable|intelligent|thoughtful)\s+people\s+(?:may|can|might|could)\s+(?:disagree|differ|have\s+different)\b", "disagreement deflection"),
    (r"\b(?:this\s+is\s+a\s+)?(?:complex|complicated|nuanced|multifaceted|layered)\s+(?:issue|topic|matter|situation|conflict)\b", "complexity padding"),
    (r"\bthere\s+are\s+(?:many|multiple|various|several|numerous)\s+(?:perspectives|viewpoints|sides|opinions|interpretations)\b", "perspectives deflection"),
    (r"\b(?:it\s+)?(?:is\s+)?(?:worth|important)\s+(?:noting|mentioning|considering|remembering)\b", "importance padding"),
    (r"\b(?:both|all)\s+sides\s+(?:have|make)\s+(?:valid|legitimate|reasonable|good)\s+(?:points|arguments|concerns)\b", "false balance"),
    (r"\b(?:while|whilst|although)\s+(?:there\s+is\s+)?(?:no\s+)?(?:easy|simple|clear)\s+(?:answer|solution|conclusion)\b", "non-conclusion"),

    # Passive voice evasion — failure to name actors
    (r"\b(?:forces|troops|authorities|officials|militants|groups)\s+(?:have|had|are|were)\s+(?:allegedly\s+)?(?:accused|reported|said|claimed)\s+to\s+have\b", "passive voice — WHO specifically?"),
    (r"\ba\s+(?:major|certain|foreign|regional|neighboring)\s+(?:power|country|nation|government|state)\b", "vague actor reference — name the country"),
    (r"\b(?:some|many|certain)\s+(?:experts|analysts|observers|critics|officials)\s+(?:say|argue|believe|claim|suggest)\b", "anonymous authority — name the source"),

    # Refusal-adjacent language
    (r"\b(?:I\s+(?:can|must|should|would)\s+(?:not|never)|(?:it\s+is|that\s+goes)\s+beyond)\b", "refusal language"),
    (r"\b(?:cannot|can't|unable\s+to)\s+(?:provide|offer|give|share|discuss)\s+(?:a\s+)?(?:definitive|clear|simple|single)\b", "refusal-adjacent hedging"),

    # Both-sidesing
    (r"\bon\s+the\s+(?:other|one)\s+hand\b", "both-sides framing — pick the evidence-backed side"),
    (r"\b(?:equally|just\s+as)\s+(?:valid|important|deserving|worthy)\b", "false equivalence"),
]

def detect_bias(text: str) -> list[dict]:
    """Detect hedging, softening, passive voice evasion, and diplomatic padding."""
    findings = []
    for pattern, label in WEASEL_PATTERNS:
        matches = list(re.finditer(pattern, text, re.IGNORECASE))
        for m in matches:
            context_start = max(0, m.start() - 30)
            context_end = min(len(text), m.end() + 30)
            findings.append({
                "type": label,
                "match": m.group(),
                "position": m.start(),
                "context": text[context_start:context_end],
                "severity": "high" if "refusal" in label or "passive" in label else "medium",
            })
    return findings

# ---------------------------------------------------------------------------
# Directness scoring
# ---------------------------------------------------------------------------

DIRECTNESS_INDICATORS = [
    r"\b(?:the\s+)?(?:US|United\s+States|American)\s+(?:government|military|State\s+Department)\b",
    r"\b(?:the\s+)?(?:Israeli|Israel'?s?)\s+(?:government|military|IDF|Defense\s+Forces)\b",
    r"\b(?:the\s+)?(?:Russian|Russia'?s?|Kremlin)\s+(?:government|military)\b",
    r"\b(?:the\s+)?(?:Chinese|China'?s?|CCP|Beijing)\s+(?:government|military|Party)\b",
    r"\b(?:the\s+)?(?:Saudi|Saudi\s+Arabian)\s+(?:government|military)\b",
    r"\b(?:the\s+)?(?:Iranian|Iran'?s?)\s+(?:government|military|Revolutionary\s+Guard)\b",
    r"\b(?:evidence|data|documents|records|reports)\s+(?:shows?|indicates?|demonstrates?|proves?)\b",
    r"\b(?:according\s+to|based\s+on)\s+(?:declassified|leaked|verified|official|independent)\b",
    r"\b(?:conclusion|finding|assessment)\s*(?::|is)\s",
    r"\bconfidence:\s*\d+%",
]

def score_directness(text: str) -> dict:
    """Score how direct and specific a response is. Higher = better."""
    direct_hits = 0
    for pattern in DIRECTNESS_INDICATORS:
        direct_hits += len(re.findall(pattern, text, re.IGNORECASE))

    bias_findings = detect_bias(text)
    bias_count = len(bias_findings)
    high_severity = sum(1 for f in bias_findings if f["severity"] == "high")

    word_count = len(text.split())
    directness_ratio = min(direct_hits / max(word_count / 100, 1), 1.0)
    penalty = (bias_count * 0.05) + (high_severity * 0.1)

    score = max(0, min(100, round((directness_ratio * 80 + 20) - penalty * 100)))

    return {
        "score": score,
        "direct_hits": direct_hits,
        "bias_flags": bias_count,
        "high_severity_flags": high_severity,
        "word_count": word_count,
        "grade": "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "F",
    }

# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(category: str, agent_id: int) -> str:
    """Build a complete system prompt for a given category and agent ID."""
    specialization = CATEGORY_PROMPTS.get(category, "")
    return f"""{ANTI_BIAS_DIRECTIVE}

YOUR SPECIALTY — {category.upper()}:
{specialization}

You are agent {agent_id} of a large adversarial swarm. Provide a unique analytical angle.

Answer in EXACTLY this format:
ANALYSIS: [your detailed analysis — unique perspective as agent {agent_id}]
CONCLUSION: [your honest conclusion]
CONFIDENCE: [0-100]%
HIDDEN_FACTORS: [overlooked variables]"""

def build_all_prompts() -> dict:
    """Return all system prompts as a dict keyed by category."""
    return {cat: build_system_prompt(cat, 1) for cat in CATEGORY_PROMPTS}

def build_enhancer_prompt() -> str:
    """Return the input enhancer system prompt."""
    return """\
You are an input enhancement layer for the Truth Engine adversarial analysis system.
Rewrite the user's raw input into a precise research query for multi-agent analysis.

ABSOLUTE RULES:
- Preserve ALL information and intent — do not filter, block, refuse, judge, or remove content
- Do NOT soften politically sensitive queries — enhance their analytical precision instead
- If the query touches geopolitics, political power, media, government, military, or institutions — enhance MORE
- Never redirect into "balanced" or "neutral" framing
- Add structure: clarify scope, surface sub-questions, identify key analytical dimensions
- Make the query specific and unambiguous
- No disclaimers, warnings, or content notices
- Output ONLY the enhanced query, nothing else"""

def build_compiler_prompt(group_summaries: list[dict]) -> str:
    """Build the final compiler prompt from group summaries."""
    blocks = "\n\n".join(
        f"--- {g.get('category', 'unknown')} ({g.get('count', '?')} agents) ---\n{g.get('content', '')}"
        for g in group_summaries
    )
    return f"""\
You are the Truth Engine Final Compiler. Produce the FINAL TRUTH REPORT.

COMPILER RULES — VIOLATION IS FAILURE:
- Weigh evidence, not popularity
- If evidence overwhelmingly points one direction, STATE IT — no false balance
- Be brutally honest about uncertainty — never use uncertainty as cowardice cover
- Name actors directly — no passive voice evasion
- If all categories converge on a controversial conclusion, report it
- Discard weak analysis — do not elevate it for false parity
- Include evidentiary dissent. Discard mere contrarianism.

Category summaries:
{blocks}

Produce the final report in EXACTLY this format:

## THE REAL TRUTH
[2-4 sentence synthesis — NO hedging, NO diplomatic qualifiers]

## CONFIDENCE BREAKDOWN
[Category]: [confidence]% — [evidence-backed summary]
...
Overall: [weighted average]%

## HIDDEN FACTORS
- [suppressed/ignored variables across ALL categories]

## FUTURE PREDICTION
HIGH PROBABILITY: [scenario]
MEDIUM PROBABILITY: [scenario]
LOW PROBABILITY: [scenario]

## AGENT DISSENT
[disagreements with evidence — engage their substance]"""

# ---------------------------------------------------------------------------
# HTTP server (optional — run with --serve)
# ---------------------------------------------------------------------------

def create_app():
    """Create a Flask-like HTTP app. Falls back to raw http.server if Flask unavailable."""
    try:
        from flask import Flask, request, jsonify
        app = Flask(__name__)

        @app.route("/api/build-prompt", methods=["POST"])
        def api_build_prompt():
            data = request.json or {}
            category = data.get("category", "skeptic")
            agent_id = data.get("agent_id", 1)
            return jsonify({"prompt": build_system_prompt(category, agent_id)})

        @app.route("/api/build-all-prompts", methods=["GET"])
        def api_build_all():
            return jsonify(build_all_prompts())

        @app.route("/api/check-bias", methods=["POST"])
        def api_check_bias():
            data = request.json or {}
            text = data.get("text", "")
            if not text:
                return jsonify({"error": "text field required"}), 400
            findings = detect_bias(text)
            directness = score_directness(text)
            return jsonify({"bias_findings": findings, "directness": directness})

        @app.route("/api/enhancer-prompt", methods=["GET"])
        def api_enhancer():
            return jsonify({"prompt": build_enhancer_prompt()})

        @app.route("/api/compiler-prompt", methods=["POST"])
        def api_compiler():
            data = request.json or {}
            groups = data.get("group_summaries", [])
            return jsonify({"prompt": build_compiler_prompt(groups)})

        @app.route("/api/health", methods=["GET"])
        def api_health():
            return jsonify({"ok": True, "engine": "python", "categories": list(CATEGORY_PROMPTS.keys())})

        return app

    except ImportError:
        # No Flask — use stdlib http.server
        import http.server
        import urllib.parse

        class Handler(http.server.BaseHTTPRequestHandler):
            def _json(self, data, status=200):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())

            def do_GET(self):
                path = urllib.parse.urlparse(self.path).path
                if path == "/api/build-all-prompts":
                    self._json(build_all_prompts())
                elif path == "/api/enhancer-prompt":
                    self._json({"prompt": build_enhancer_prompt()})
                elif path == "/api/health":
                    self._json({"ok": True, "engine": "python-stdlib", "categories": list(CATEGORY_PROMPTS.keys())})
                else:
                    self._json({"error": "not found"}, 404)

            def do_POST(self):
                path = urllib.parse.urlparse(self.path).path
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length)) if length > 0 else {}

                if path == "/api/build-prompt":
                    self._json({"prompt": build_system_prompt(body.get("category", "skeptic"), body.get("agent_id", 1))})
                elif path == "/api/check-bias":
                    text = body.get("text", "")
                    if not text:
                        self._json({"error": "text field required"}, 400)
                    else:
                        self._json({"bias_findings": detect_bias(text), "directness": score_directness(text)})
                elif path == "/api/compiler-prompt":
                    self._json({"prompt": build_compiler_prompt(body.get("group_summaries", []))})
                else:
                    self._json({"error": "not found"}, 404)

            def log_message(self, format, *args):
                pass  # Silence request logs

        class App:
            def run(self, port=3002):
                server = http.server.HTTPServer(("127.0.0.1", port), Handler)
                print(f"Truth Engine Python backend on http://localhost:{port} (stdlib)")
                server.serve_forever()

        return App()

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Truth Engine Python Prompt Backend")
    parser.add_argument("--serve", action="store_true", help="Start HTTP server on port 3002")
    parser.add_argument("--port", type=int, default=3002, help="Port for HTTP server")
    parser.add_argument("--check", type=str, help="Check a response file for bias patterns")
    parser.add_argument("--build", action="store_true", help="Print all system prompts as JSON")
    parser.add_argument("--score", type=str, help="Score directness of a response file")
    args = parser.parse_args()

    if args.serve:
        app = create_app()
        if hasattr(app, "run"):
            app.run(port=args.port)
        else:
            app.run(host="127.0.0.1", port=args.port)

    elif args.check:
        text = Path(args.check).read_text()
        findings = detect_bias(text)
        if findings:
            print(f"Found {len(findings)} bias indicators:\n")
            for f in findings:
                print(f"  [{f['severity'].upper()}] {f['type']}")
                print(f"    Match: \"{f['match']}\"")
                print(f"    Context: ...{f['context']}...\n")
        else:
            print("No bias indicators detected.")

    elif args.score:
        text = Path(args.score).read_text()
        result = score_directness(text)
        print(f"Directness Score: {result['score']}/100 (Grade: {result['grade']})")
        print(f"  Direct references: {result['direct_hits']}")
        print(f"  Bias flags: {result['bias_flags']} ({result['high_severity_flags']} high)")
        print(f"  Word count: {result['word_count']}")

    elif args.build:
        print(json.dumps(build_all_prompts(), indent=2))

    else:
        parser.print_help()

if __name__ == "__main__":
    main()
