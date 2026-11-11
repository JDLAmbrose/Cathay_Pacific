"""Verify the built multi-page preview and copied kanban over HTTP."""

import functools
import threading
import unittest
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urljoin, urlsplit

from tools import serve


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        key = "src" if tag in ("script", "img") else "href" if tag == "link" else None
        if key and attrs.get(key):
            self.urls.append(attrs[key])


@unittest.skipUnless((serve.DIST / "index.html").is_file(), "Run npm run build first")
class FrontendHTTPTests(unittest.TestCase):
    def test_built_pages_and_their_resources(self):
        class QuietHandler(serve.Handler):
            def log_message(self, *args):
                pass

        with ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler) as server:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                origin = f"http://127.0.0.1:{server.server_port}/"
                pages = list(serve.DIST.glob("*.html")) + list(serve.DIST.glob("pages/**/*.html"))
                self.assertGreaterEqual(len(pages), 13)
                for path in pages:
                    with self.subTest(page=path.relative_to(serve.DIST)):
                        url = urljoin(origin, path.relative_to(serve.DIST).as_posix())
                        with urlopen(url) as response:
                            self.assertEqual(response.status, 200)
                            html = response.read().decode()
                        refs = References()
                        refs.feed(html)
                        for ref in refs.urls:
                            with urlopen(urljoin(url, ref)) as resource:
                                self.assertEqual(resource.status, 200)
                                resource.read()
                with urlopen(origin + "pages/hold-pressure/data/kanban-snapshot.json") as response:
                    self.assertEqual(response.status, 200)
                    response.read()
            finally:
                server.shutdown()
                worker.join()

    def test_project_pages_paths(self):
        # Serve dist under /Cathay_Pacific/ just like a GitHub project site.
        # PLUME_BASE_PATH is set for the dedicated subpath build in CI.
        import os
        import tempfile

        base = os.environ.get("PLUME_BASE_PATH", "/")
        if base == "/":
            self.skipTest("Dedicated GitHub Pages subpath build")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            mount = root / base.strip("/")
            mount.parent.mkdir(parents=True, exist_ok=True)
            mount.symlink_to(serve.DIST, target_is_directory=True)
            class QuietStaticHandler(SimpleHTTPRequestHandler):
                def log_message(self, *args):
                    pass
            handler = functools.partial(QuietStaticHandler, directory=str(root))
            with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
                worker = threading.Thread(target=server.serve_forever, daemon=True)
                worker.start()
                try:
                    origin = f"http://127.0.0.1:{server.server_port}/"
                    for path in serve.DIST.glob("**/*.html"):
                        url = origin.rstrip("/") + base + path.relative_to(serve.DIST).as_posix()
                        with urlopen(url) as response:
                            refs = References()
                            refs.feed(response.read().decode())
                        for ref in refs.urls:
                            resource_url = urljoin(url, ref)
                            self.assertTrue(urlsplit(resource_url).path.startswith(base))
                            with urlopen(resource_url) as response:
                                self.assertEqual(response.status, 200)
                                response.read()
                finally:
                    server.shutdown()
                    worker.join()
