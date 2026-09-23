from __future__ import annotations

import argparse
import http.server
import os
import socketserver
from pathlib import Path


class UnityWebHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".js": "application/javascript",
        ".data": "application/octet-stream",
        ".json": "application/json",
    }

    def end_headers(self) -> None:
        if self.path.endswith(".br"):
            self.send_header("Content-Encoding", "br")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def guess_type(self, path: str) -> str:
        if path.endswith(".br"):
            path = path[:-3]
        return super().guess_type(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    if not (root / "index.html").exists():
        raise SystemExit(f"index.html bulunamadı: {root}")
    os.chdir(root)
    with socketserver.ThreadingTCPServer(("127.0.0.1", args.port), UnityWebHandler) as server:
        print(f"Bozkurt WebGL: http://127.0.0.1:{args.port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
