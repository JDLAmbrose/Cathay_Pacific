"""Serve the Plume Light prototype and its demo handover tracking API."""

import argparse
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
TRACKING_PATH = "/api/handover/tracking"
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
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlsplit(self.path).path != TRACKING_PATH:
            self.send_json(404, {"error": "not_found"})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "expected_json"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 1_048_576:
                self.send_json(413, {"error": "request_too_large"})
                return
            if length <= 0:
                raise ValueError("Missing body")
            result = tracking_lookup(json.loads(self.rfile.read(length)))
        except (ValueError, RecursionError):
            self.send_json(400, {"error": "invalid_request"})
            return
        self.send_json(200, result)

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        if path == TRACKING_PATH:
            self.send_error(405, "Use POST")
            return None
        target = Path(self.translate_path(path)).resolve()
        public = target in (ROOT, ROOT / "index.html") or any(
            target.is_file() and directory in target.parents
            for directory in (ROOT / "assets", ROOT / "pages")
        )
        if not public:
            self.send_error(404)
            return None
        return super().send_head()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.bind, args.port), Handler) as server:
        print(f"Plume Light: http://{args.bind}:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
