from flask import Flask, jsonify
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import os
import json
import time
import requests

load_dotenv()

s3_client = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION"),
)
app = Flask(__name__)
CORS(app)

STATS_FILE = os.path.join(os.path.dirname(__file__), "data", "stats.json")
POLL_INTERVAL = 30

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
        new_contributions = (
            gh["data"]["user"]["contributionsCollection"]["contributionCalendar"][
                "totalContributions"
            ]
        )
        if new_contributions != stats["github"]["totalContributions"]:
            stats["github"]["totalContributions"] = new_contributions
            stats["github"]["timestamp"] = int(time.time())
    except Exception:
        pass

    save_stats(stats)


@app.route("/presign/<path:object_key>")
def get_presigned_url(object_key):
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": os.getenv("S3_BUCKET"), "Key": object_key},
            ExpiresIn=3600,
        )
        return jsonify({"url": url})
    except ClientError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/stats")
def get_stats():
    return jsonify(load_stats())


scheduler = BackgroundScheduler()
scheduler.add_job(fetch_stats, "interval", seconds=POLL_INTERVAL)
scheduler.start()

if __name__ == "__main__":
    app.run(debug=True)
