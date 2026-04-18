import os
import boto3
from botocore.exceptions import ClientError
from flask import jsonify, request
from data import load_stats
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
