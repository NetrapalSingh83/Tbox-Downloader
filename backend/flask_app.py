# ─────────────────────────────────────────────────────────────────────────────
#  Tbox Downloader – Flask Backend
#  Mode 1 (primary)  : terabox1.py  → Direct Terabox APIs, zero third-party
#  Mode 2 (fallback) : terabox2.py  → Cookie-based, still zero third-party
#
#  /generate_file  → returns file list + sign/timestamp/uk/shareid/js_token
#  /generate_link  → returns 3 download links + 1 stream link
# ─────────────────────────────────────────────────────────────────────────────

import json
from flask import Flask, Response, request
from flask_cors import CORS

app = Flask(__name__)

# During development: allow all origins.
# Before deploying: change "*" to your actual frontend URL, e.g.
#   "https://netrapalsingh83.github.io"
CORS(app, resources={r"/*": {"origins": "https://netrapalsingh83.github.io/Tbox-Downloader/","http://127.0.0.1:5500/"}})

from python.terabox1 import TeraboxFile as TF1, TeraboxLink as TL1
from python.terabox2 import TeraboxFile as TF2

# ── helpers ───────────────────────────────────────────────────────────────────

def json_response(data: dict, status: int = 200) -> Response:
    return Response(
        response=json.dumps(data, sort_keys=False),
        status=status,
        mimetype="application/json"
    )

# ── routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return json_response({
        "status": "ok",
        "message": "Tbox Downloader API is running",
        "endpoints": ["/get_config", "/generate_file", "/generate_link"]
    })


@app.route("/get_config", methods=["GET"])
def get_config():
    return json_response({
        "status": "success",
        "message": "API ready – your own backend, no third-party"
    })


@app.route("/generate_file", methods=["POST"])
def generate_file():
    """
    Body:  { "url": "<terabox share link>" }
    Returns:
      {
        status, uk, shareid, sign, timestamp,
        js_token, cookie,
        list: [ { name, size, type, fs_id, image, is_dir, list } ]
      }
    Tries Mode 1 first (direct Terabox), then Mode 2 (cookie-based fallback).
    """
    try:
        data = request.get_json(silent=True) or {}
        url  = (data.get("url") or "").strip()

        if not url:
            return json_response({"status": "failed", "message": "url is required"}, 400)

        # ── Mode 1: Direct Terabox ────────────────────────────────────────────
        try:
            tf = TF1()
            tf.search(url)
            if tf.result.get("status") == "success":
                print("[Mode 1] SUCCESS")
                return json_response(tf.result)
            print("[Mode 1] returned non-success:", tf.result.get("status"))
        except Exception as e:
            print(f"[Mode 1] Exception: {e}")

        # ── Mode 2: Cookie-based fallback ─────────────────────────────────────
        try:
            tf = TF2(cookie="")
            tf.search(url)
            if tf.result.get("status") == "success":
                print("[Mode 2] SUCCESS")
                return json_response(tf.result)
            print("[Mode 2] returned non-success:", tf.result.get("status"))
        except Exception as e:
            print(f"[Mode 2] Exception: {e}")

        return json_response({
            "status": "failed",
            "message": "Could not fetch file info from Terabox. The link may be invalid or expired."
        })

    except Exception as e:
        return json_response({"status": "failed", "message": str(e)})


@app.route("/generate_link", methods=["POST"])
def generate_link():
    """
    Body:  { fs_id, uk, shareid, timestamp, sign, js_token, cookie }
    Returns:
      {
        status,
        download_link: {
          url_1: "...",   ← Standard speed  (Terabox dlink)
          url_2: "...",   ← Fast speed      (CDN direct, by=dapunta)
          url_3: "..."    ← Fastest speed   (d3 CDN domain, by=dapunta)
        },
        stream_link: "..."  ← url_2 or url_1, best for <video> src
      }
    """
    try:
        data     = request.get_json(silent=True) or {}
        required = {"fs_id", "uk", "shareid", "timestamp", "sign", "js_token", "cookie"}
        missing  = required - set(data.keys())

        if missing:
            return json_response({
                "status": "failed",
                "message": f"Missing params: {', '.join(sorted(missing))}"
            }, 400)

        tl = TL1(
            fs_id     = str(data["fs_id"]),
            uk        = str(data["uk"]),
            shareid   = str(data["shareid"]),
            timestamp = str(data["timestamp"]),
            sign      = str(data["sign"]),
            js_token  = str(data["js_token"]),
            cookie    = str(data["cookie"])
        )
        tl.generate()
        result = tl.result

        if result.get("status") == "success":
            dl = result.get("download_link", {})
            # stream_link: prefer url_2 (direct CDN, best for inline playback)
            result["stream_link"] = dl.get("url_2") or dl.get("url_1") or ""
            print(f"[generate_link] SUCCESS – links: {list(dl.keys())}")
        else:
            print("[generate_link] FAILED")

        return json_response(result)

    except Exception as e:
        return json_response({"status": "failed", "message": str(e)})


# ── run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
