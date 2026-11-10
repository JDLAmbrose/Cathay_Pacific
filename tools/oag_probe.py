#!/usr/bin/env python3
"""Small, read-only OAG explorer. Keys stay in local files or environment variables."""

import argparse
import gzip
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


PRODUCTS = {
    "flights": ("flight-instances", "v2", "flightinfo", "OAG_FLIGHTINFO_KEY"),
    "connections": ("flight-connections", "v1", "connection", "OAG_CONNECTION_KEY"),
    "locations": ("locations", "v1", "master", "OAG_MASTER_KEY"),
    "carriers": ("carriers", "v1", "master", "OAG_MASTER_KEY"),
    "equipment": ("equipment", "v1", "master", "OAG_MASTER_KEY"),
}


class NoRedirect(HTTPRedirectHandler):
    # Never forward a subscription key to a redirected host.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_body(response):
    raw = response.read()
    if response.headers.get("Content-Encoding", "").lower() == "gzip" or raw.startswith(b"\x1f\x8b"):
        raw = gzip.decompress(raw)
    return raw.decode("utf-8", errors="replace")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("product", choices=PRODUCTS)
    parser.add_argument("params", nargs="*", help="OAG query parameters as Name=Value")
    parser.add_argument("--key-dir", type=Path, default=Path.home() / "Desktop")
    parser.add_argument("--output", type=Path, help="Save response envelope as JSON")
    args = parser.parse_args()
    endpoint, version, filename, env_name = PRODUCTS[args.product]
    params = {"version": version, "Limit": "1"}
    for item in args.params:
        name, sep, value = item.partition("=")
        if not sep or not name:
            parser.error("Parameters must use Name=Value")
        if name.lower() in {"subscription-key", "key", "apikey", "api_key"}:
            parser.error("Credentials must not be passed as query parameters")
        params[name] = value
    try:
        limit = int(params["Limit"])
        if not 1 <= limit <= 10:
            raise ValueError()
    except ValueError:
        parser.error("This exploration tool limits each request to 1–10 results")
    try:
        key = os.environ.get(env_name) or (args.key_dir / (filename + ".txt")).read_text().strip()
    except OSError:
        parser.error(f"Set {env_name} or provide {filename}.txt in --key-dir")
    if not key or any(c.isspace() for c in key):
        parser.error("Key must be a single nonempty token")
    url = f"https://api.oag.com/{endpoint}/?{urlencode(params)}"
    request = Request(url, headers={"Subscription-Key": key, "Accept": "application/json"})
    result = {"checkedAtUtc": datetime.now(timezone.utc).isoformat(), "product": args.product, "url": url}
    try:
        with build_opener(NoRedirect()).open(request, timeout=30) as response:
            status, raw = response.status, read_body(response)
    except HTTPError as error:
        status, raw = error.code, read_body(error)
    except (URLError, TimeoutError):
        print("OAG connection failed; check network access and retry.", file=sys.stderr)
        return 2
    raw = raw.replace(key, "[REDACTED]")
    result["httpStatus"] = status
    try:
        result["response"] = json.loads(raw)
    except json.JSONDecodeError:
        result["response"] = raw
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n")
        body = result["response"]
        count = len(body["data"]) if isinstance(body, dict) and isinstance(body.get("data"), list) else None
        print(json.dumps({"product": args.product, "httpStatus": status, "records": count, "output": str(args.output)}))
    else:
        print(rendered)
    return 0 if 200 <= status < 300 else 1


if __name__ == "__main__":
    sys.exit(main())
