import os
import json
import time
import requests

from datetime import datetime, timezone

STATS_FILE = os.path.join(os.path.dirname(__file__), "data", "stats.json")

DEFAULT_STATS = {
    "leetcode": {"timestamp": -1, "solvedProblem": 0},
    "github": {"timestamp": -1, "totalContributions": 0},
}

GH_QUERY = """
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
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
            f"https://alfa-leetcode-api.onrender.com/{os.getenv("LC_USER")}/solved",
            timeout=10,
        ).json()
        new_solved = lc.get("solvedProblem", stats["leetcode"]["solvedProblem"])
        if new_solved != stats["leetcode"]["solvedProblem"]:
            stats["leetcode"]["solvedProblem"] = new_solved
            stats["leetcode"]["timestamp"] = int(time.time())
    except Exception:
        pass

    try:
        new_contributions = fetch_github_contributions(os.getenv("GH_TOKEN"))
        if new_contributions != stats["github"]["totalContributions"]:
            stats["github"]["totalContributions"] = new_contributions
            stats["github"]["timestamp"] = int(time.time())
    except Exception:
        pass

    save_stats(stats)

def fetch_github_contributions(token):
    current_year = datetime.now(timezone.utc).year
    total = 0
    for year in range(int(os.getenv("START_YEAR")), current_year + 1):
        variables = {
            "login": os.getenv("GH_USER"),
            "from": f"{year}-01-01T00:00:00Z",
            "to":   f"{year}-12-31T23:59:59Z",
        }
        gh = requests.post(
            "https://api.github.com/graphql",
            json={"query": GH_QUERY, "variables": variables},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        ).json()
        total += gh["data"]["user"]["contributionsCollection"][
            "contributionCalendar"
        ]["totalContributions"]
    return total
