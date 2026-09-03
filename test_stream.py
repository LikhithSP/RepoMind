import httpx
import json

def test():
    with httpx.Client(timeout=30.0) as client:
        health = client.get("http://127.0.0.1:8000/health")
        print("Health status:", health.json())

        with client.stream(
            "POST",
            "http://127.0.0.1:8000/query",
            json={"query": "how to install this", "provider": "groq", "model": "llama-3.1-8b-instant", "top_k": 5}
        ) as response:
            print("Query HTTP status:", response.status_code)
            for line in response.iter_lines():
                if line.startswith("data:"):
                    print(line[:200])

if __name__ == "__main__":
    test()
