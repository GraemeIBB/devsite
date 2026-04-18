import os
import json
import time
import requests

STATS_FILE = os.path.join(os.path.dirname(__file__), "data", "stats.json")

DEFAULT_STATS = {
    "leetcode": {"timestamp": -1, "solvedProblem": 0},
    "github": {"timestamp": -1, "totalContributions": 0},
}

GH_QUERY = """
query {
  user(login: "graemeibb") {
    contributionsCollection {
      contributionCalendar {
        totalContributions
      }
    }
  }
}
"""


def load_stats():
    try:
        with open(STATS_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return DEFAULT_STATS.copy()


def save_stats(stats):
    os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
    with open(STATS_FILE, "w") as f:
        json.dump(stats, f, indent=2)


def fetch_stats():
    stats = load_stats()

    try:
        lc = requests.get(
            "https://alfa-leetcode-api.onrender.com/graemeibb/solved", timeout=10
        ).json()
        new_solved = lc.get("solvedProblem", stats["leetcode"]["solvedProblem"])
        if new_solved != stats["leetcode"]["solvedProblem"]:
            stats["leetcode"]["solvedProblem"] = new_solved
            stats["leetcode"]["timestamp"] = int(time.time())
    except Exception:
        pass

    try:
        gh = requests.post(
            "https://api.github.com/graphql",
            json={"query": GH_QUERY},
            headers={"Authorization": f"Bearer {os.getenv('GH_TOKEN')}"},
            timeout=10,
        ).json()
        new_contributions = gh["data"]["user"]["contributionsCollection"][
            "contributionCalendar"
        ]["totalContributions"]
        if new_contributions != stats["github"]["totalContributions"]:
            stats["github"]["totalContributions"] = new_contributions
            stats["github"]["timestamp"] = int(time.time())
    except Exception:
        pass

    save_stats(stats)
