import os
import boto3
from botocore.exceptions import ClientError
from flask import jsonify, request
from data import load_stats
from repo_search import search_code, load_features, sync_repos, summarize_repo, map_repo
import sockets


def register(app, socketio):
    s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION"))

    @app.route("/presign/<path:object_key>")
    def get_presigned_url(object_key):
        try:
            url = s3.generate_presigned_url(
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

    @app.route("/crashout", methods=["POST"])
    def set_crashout():
        data = request.get_json(silent=True) or {}
        minutes = data.get("minutes", 0)
        sockets.set_and_broadcast(socketio, minutes)
        return jsonify({"minutes": sockets.crashout_minutes})

    @app.route("/repos")
    def get_repos():
        return jsonify(load_features())

    @app.route("/repos/sync", methods=["POST"])
    def post_repos_sync():
        sync_repos()
        return jsonify(load_features())

    @app.route("/search-repos")
    def get_search_repos():
        return jsonify(search_code(request.args.get("q", ""), repo_id=request.args.get("id")))

    @app.route("/repos/<repo_id>/summary")
    def get_repo_summary(repo_id):
        return jsonify(summarize_repo(repo_id))

    @app.route("/repos/<repo_id>/map")
    def get_repo_map(repo_id):
        return jsonify(map_repo(repo_id))
