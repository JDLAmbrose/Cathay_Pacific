"""Read-only curated customs summaries. Never fetch model-supplied URLs or file paths."""
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data" / "customs_policies.json"
DESTINATIONS = ("GB", "CN", "JP", "HK", "AU")
TOPICS = ("all", "general", "food", "medicine", "duty_free", "restricted")
ALIASES = {
    "GB": ("GB", "UK", "UNITED KINGDOM", "GREAT BRITAIN", "英国", "英國", "LHR", "LGW", "MAN", "EDI"),
    "CN": ("CN", "CHINA", "MAINLAND CHINA", "中国", "中國", "中国内地", "中國內地", "PEK", "PKX", "PVG", "SHA", "CAN", "SZX"),
    "JP": ("JP", "JAPAN", "日本", "NRT", "HND", "KIX", "NGO"),
    "HK": ("HK", "HKG", "HONG KONG", "香港", "中国香港", "中國香港"),
    "AU": ("AU", "AUSTRALIA", "澳大利亚", "澳大利亞", "澳洲", "SYD", "MEL", "BNE", "PER", "ADL"),
}


def load_library():
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def resolve_destination(context):
    trip = context.get("trip", {})
    value = trip.get("enquiryDestination") or trip.get("flight", {}).get("destination", "")
    if not isinstance(value, str):
        return None
    value = value.strip().upper()
    for code, aliases in ALIASES.items():
        if value in aliases:
            return code
    # Only exact known airport tokens; never infer a country from arbitrary instructions.
    tokens = set(re.findall(r"\b[A-Z]{3}\b", value))
    matches = {code for code, aliases in ALIASES.items() if tokens.intersection(aliases)}
    return matches.pop() if len(matches) == 1 else None


def lookup(destination, topic="all", today=None):
    if destination not in DESTINATIONS and destination is not None:
        raise ValueError("Unsupported destination")
    if topic not in TOPICS:
        raise ValueError("Unsupported topic")
    library = load_library()
    today = today or datetime.now(timezone.utc).date()
    age = (today - date.fromisoformat(library["reviewed_on"])).days
    result = {
        "source": "stored_official_customs_summary", "live": False,
        "version": library["version"], "reviewed_on": library["reviewed_on"],
        "review_due": age < 0 or age > library["review_after_days"],
        "scope": library["scope"], "destination": destination, "topic": topic,
        "supported_destinations": list(DESTINATIONS),
        "notice": "Saved summaries, not a live official lookup or clearance decision. Cite sources and review date. Check scope, origin and travel date. Missing rules do not mean permission. Airline/security rules are not covered.",
    }
    if destination is None:
        return {**result, "status": "destination_required", "rules": [], "sources": []}
    entry = library["destinations"][destination]
    rules = [r for r in entry["rules"] if topic == "all" or topic in r["topics"]]
    source_ids = {source for rule in rules for source in rule["source_ids"]}
    return {**result, "status": "found" if rules else "not_covered",
            "name": entry["name"], "destination_scope": entry["scope"],
            "gaps": entry["gaps"], "rules": rules,
            "sources": [s for s in entry["sources"] if s["id"] in source_ids]}
