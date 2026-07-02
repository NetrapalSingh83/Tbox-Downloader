# ─────────────────────────────────────────────────────────────────────────────
#  Tbox Downloader – Flask Backend
#  Mode 1 (primary)  : terabox1.py  → Direct Terabox APIs, zero third-party
#  Mode 2 (fallback) : terabox2.py  → Cookie-based, still zero third-party
# ─────────────────────────────────────────────────────────────────────────────

import json
from flask import Flask, Response, request
from flask_cors import CORS
from python.terabox1 import TeraboxFile as TF1, TeraboxLink as TL1
from python.terabox2 import TeraboxFile as TF2, TeraboxLink as TL2

app = Flask(__name__)

# Allow all origins during development.
# Before deploying change "*" to your actual frontend URL, e.g.
#   "https://netrapalsingh83.github.io"
CORS(app, resources={r"/*": {"origins": "http://127.0.0.1:5500/"}})

from python.terabox1 import TeraboxFile as TF1, TeraboxLink as TL1
from python.terabox2 import TeraboxFile as TF2

# ── Force CORS headers on EVERY response (including 500 errors) ───────────────
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

# ── Always return JSON even for unhandled crashes ─────────────────────────────
@app.errorhandler(Exception)
def handle_exception(e):
    print(f"[UNHANDLED] {type(e).__name__}: {e}")
    return json_response({"status": "failed", "message": f"Server error: {str(e)}"}, 500)

@app.errorhandler(404)
def not_found(e):
    return json_response({"status": "failed", "message": "Endpoint not found"}, 404)

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
    Returns file list + sign/timestamp/uk/shareid/js_token/cookie
    Tries Mode 1 first (direct Terabox), then Mode 2 (cookie-based fallback).
    """
    data = request.get_json(silent=True) or {}
    url  = (data.get("url") or "").strip()

    if not url:
        return json_response({"status": "failed", "message": "url is required"}, 400)

    errors = []

    # ── Mode 1: Direct Terabox ────────────────────────────────────────────────
    try:
        tf = TF1()
        tf.search(url)
        if tf.result.get("status") == "success":
            tf.result["mode"] = 1
            print("[Mode 1] SUCCESS")
            return json_response(tf.result)
        err = tf.result.get("status", "unknown")
        print(f"[Mode 1] non-success: {err}")
        errors.append(f"Mode1: {err}")
    except Exception as e:
        print(f"[Mode 1] Exception: {type(e).__name__}: {e}")
        errors.append(f"Mode1: {type(e).__name__}: {e}")

    # ── Mode 2: Cookie-based fallback ─────────────────────────────────────────
    try:
        tf = TF2(cookie="")
        tf.search(url)
        if tf.result.get("status") == "success":
            tf.result["mode"] = 2
            print("[Mode 2] SUCCESS")
            return json_response(tf.result)
        err = tf.result.get("status", "unknown")
        print(f"[Mode 2] non-success: {err}")
        errors.append(f"Mode2: {err}")
    except Exception as e:
        print(f"[Mode 2] Exception: {type(e).__name__}: {e}")
        errors.append(f"Mode2: {type(e).__name__}: {e}")

    return json_response({
        "status": "failed",
        "message": "Could not fetch file info. The link may be invalid or expired.",
        "debug": errors
    })


@app.route("/generate_link", methods=["POST"])
def generate_link():
    """
    Body:  { fs_id, uk, shareid, timestamp, sign, js_token, cookie }
    Returns download_link: { url_1, url_2, url_3 } + stream_link
    """
    data     = request.get_json(silent=True) or {}
    mode = data.get("mode", 1)

    if mode == 2:
        link = data.get("link")            # the per-file dlink from Mode 2's file list
        if not link:
            return json_response({"status": "failed", "message": "link is required for mode 2"}, 400)
        try:
            tl = TL2(link)                 # terabox2.TeraboxLink resolves fast mirrors in __init__
            result = tl.result
            dl = result.get("download_link", {})
            result["stream_link"] = dl.get("url_2") or dl.get("url_1") or ""
            return json_response(result)
        except Exception as e:
            return json_response({"status": "failed", "message": str(e)})
        
    required = {"fs_id", "uk", "shareid", "timestamp", "sign", "js_token", "cookie"}
    missing  = required - set(data.keys())

    if missing:
        return json_response({
            "status": "failed",
            "message": f"Missing params: {', '.join(sorted(missing))}"
        }, 400)

    try:
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
            result["stream_link"] = dl.get("url_2") or dl.get("url_1") or ""
            print(f"[generate_link] SUCCESS – links: {list(dl.keys())}")
        else:
            print("[generate_link] FAILED")

        return json_response(result)

    except Exception as e:
        print(f"[generate_link] Exception: {type(e).__name__}: {e}")
        return json_response({"status": "failed", "message": str(e)})


# ── run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
