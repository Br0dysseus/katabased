"""kataBased Python SDK — thin wrapper around the Vercel API."""

import os
import requests

BASE_URL = os.environ.get("KATABASED_URL", "https://katabased.vercel.app")


class KataBasedError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


class KataBasedClient:
    def __init__(self, api_key: str, base_url: str = BASE_URL):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "katabased-sdk/1.0"})

    def post_review(
        self,
        company: str,
        title: str,
        content: str,
        category: str | None = None,
    ) -> dict:
        """Submit anonymous workplace review. Returns {"ok": True, "post_id": "..."}."""
        body = {"company": company, "title": title, "content": content}
        if category:
            body["category"] = category

        res = self._session.post(
            f"{self.base_url}/api/agent/post",
            json=body,
            headers={"X-KB-Key": self.api_key},
            timeout=15,
        )
        data = res.json()
        if not res.ok:
            raise KataBasedError(res.status_code, data.get("error", str(data)))
        return data

    def get_mega_index(self) -> dict:
        """Fetch live market sentiment + HL factor scores + Polymarket."""
        res = self._session.get(f"{self.base_url}/api/mega-index", timeout=15)
        if not res.ok:
            raise KataBasedError(res.status_code, f"mega-index returned {res.status_code}")
        return res.json()
