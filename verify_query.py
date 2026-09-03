import urllib.request
import json

data = json.dumps({
    "query": "how to install this",
    "provider": "groq",
    "model": "openai/gpt-oss-20b",
    "top_k": 5
}).encode("utf-8")

req = urllib.request.Request(
    "http://127.0.0.1:8000/query",
    data=data,
    headers={"Content-Type": "application/json"}
)

try:
    resp = urllib.request.urlopen(req, timeout=30)
    print("Status:", resp.status)
    tokens = []
    for raw in resp:
        line = raw.decode("utf-8", errors="ignore").strip()
        if line.startswith("data:"):
            try:
                payload = json.loads(line[5:].strip())
                if "token" in payload:
                    tokens.append(payload["token"])
                if "answer" in payload:
                    print("\n--- FINAL ANSWER ---\n", payload["answer"])
                    print("\n--- SOURCES COUNT ---:", len(payload.get("sources", [])))
            except Exception:
                pass
except Exception as e:
    print("Error:", e)
