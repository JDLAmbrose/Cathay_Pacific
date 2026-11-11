"""Serve the Plume Light prototype and its demo handover tracking API."""

import argparse
import hashlib
import json
import os
import threading
import time
from collections import deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

try:
    from . import assistant
except ImportError:
    import assistant


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
TRACKING_PATH = "/api/handover/tracking"
CHAT_PATH = "/api/assistant/chat"
CHAT_SLOTS = threading.BoundedSemaphore(2)
CHAT_TIMES = deque()
CHAT_LOCK = threading.Lock()


def allow_chat():
    # Per-process cost guard, intentionally independent of untrusted proxy headers.
    with CHAT_LOCK:
        now = time.monotonic()
        while CHAT_TIMES and CHAT_TIMES[0] < now - 60:
            CHAT_TIMES.popleft()
        if len(CHAT_TIMES) >= 20:
            return False
        CHAT_TIMES.append(now)
        return True


CARRIER_LINKS = {
    "EBC UK": None,
    "Parcelforce Worldwide": "https://www.parcelforce.com/track-trace",
    "DHL eCommerce UK": "https://track.dhlparcel.co.uk/",
    "DHL": "https://www.dhl.com/global-en/home/tracking.html",
    "SF Express": "https://www.sf-international.com/us/en//dynamic_function/waybill/",
    "EMS": "https://www.ems.post/en/global-network/tracking",
    "Australia Post": "https://auspost.com.au/mypost/track/details",
    "Japan Post": "https://www.post.japanpost.jp/receive/tracking/",
    "Yamato Transport": "https://www.kuronekoyamato.co.jp/ytc/en/about-tracking.html",
    "India Post": "https://www.indiapost.gov.in/",
    "La Poste": "https://www.laposte.fr/outils/suivre-vos-envois",
}


def is_identifier(value):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= 200


def tracking_lookup(payload):
    if not isinstance(payload, dict):
        raise ValueError("Expected an object")
    order = payload.get("order")
    events = payload.get("handoverEvents")
    if not isinstance(order, dict) or not isinstance(events, list):
        raise ValueError("Expected order and handoverEvents")

    order_id, leg_id, created_at = (order.get(key) for key in ("id", "legId", "createdAt"))
    carrier = order.get("carrier")
    items = order.get("itemIds")
    if not all(is_identifier(value) for value in (order_id, leg_id, created_at, carrier)):
        raise ValueError("Invalid order identifiers")
    if not isinstance(items, list) or not items or not all(map(is_identifier, items)):
        raise ValueError("Expected at least one service bag")
    if order.get("status") not in ("paid_demo", "completed"):
        return {"status": "pending"}

    confirmed = set()
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("Invalid handover event")
        if (event.get("type"), event.get("orderId"), event.get("legId")) != (
            "handover", order_id, leg_id
        ):
            continue
        item_ids = event.get("itemIds")
        if not isinstance(item_ids, list) or not all(map(is_identifier, item_ids)):
            raise ValueError("Invalid handover items")
        if is_identifier(event.get("confirmedAt")):
            confirmed.update(item_ids)
    if not set(items).issubset(confirmed):
        return {"status": "pending"}

    # Stable across refresh and independent of event order. The carrier never issues this number.
    reference = json.dumps([order_id, leg_id, created_at, carrier, sorted(set(items))])
    digest = hashlib.sha256(reference.encode()).hexdigest()[:12].upper()
    return {
        "status": "ready",
        "trackingNumber": f"DEMO-{digest}",
        "carrierName": carrier,
        "trackingUrl": CARRIER_LINKS.get(carrier),
        "demo": True,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.frontend_built = (DIST / "index.html").is_file()
        self.public_root = DIST if self.frontend_built else ROOT
        super().__init__(*args, directory=str(self.public_root), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if urlsplit(self.path).path == "/api/assistant/status":
            self.send_json(200, assistant.configuration())
            return
        super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in (TRACKING_PATH, CHAT_PATH):
            self.send_json(404, {"error": "not_found"})
            return
        origin = self.headers.get("Origin")
        if path == CHAT_PATH and (self.headers.get("Sec-Fetch-Site") == "cross-site" or
                origin and (urlsplit(origin).scheme not in ("http", "https") or
                            urlsplit(origin).netloc != self.headers.get("Host"))):
            self.send_json(403, {"error": "origin_not_allowed"})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "expected_json"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > (131_072 if path == CHAT_PATH else 1_048_576):
                self.send_json(413, {"error": "request_too_large"})
                return
            if length <= 0:
                raise ValueError("Missing body")
            self.connection.settimeout(10)
            payload = json.loads(self.rfile.read(length))
            if path == CHAT_PATH:
                assistant.validate_payload(payload)
                if not assistant.configuration()["configured"]:
                    raise assistant.AgentError("not_configured", 503)
                if not allow_chat():
                    raise assistant.AgentError("rate_limit", 429)
                if not CHAT_SLOTS.acquire(blocking=False):
                    raise assistant.AgentError("busy", 429)
                try:
                    result = assistant.chat(payload)
                finally:
                    CHAT_SLOTS.release()
            else:
                result = tracking_lookup(payload)
        except assistant.AgentError as exc:
            self.send_json(exc.status, {"error": exc.code})
            return
        except (ValueError, RecursionError, TimeoutError):
            self.send_json(400, {"error": "invalid_request"})
            return
        self.send_json(200, result)

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if path in (TRACKING_PATH, CHAT_PATH):
            self.send_error(405, "Use POST")
            return None
        target = Path(self.translate_path(path)).resolve()
        public = target in (self.public_root, self.public_root / "index.html") or any(
            target.is_file() and directory in target.parents
            for directory in (self.public_root / "assets", self.public_root / "pages")
        )
        if not public:
            self.send_error(404)
            return None
        if not self.frontend_built:
            self.send_error(503, "Run npm run build or use the Vite development server")
            return None
        return super().send_head()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    parser.add_argument("--api-key-file", help="Read GLM key from a private file outside the website")
    args = parser.parse_args()
    if args.api_key_file:
        os.environ["GLM_API_KEY_FILE"] = args.api_key_file
    with ThreadingHTTPServer((args.bind, args.port), Handler) as server:
        print(f"Plume Light: http://{args.bind}:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
