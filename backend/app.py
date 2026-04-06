from flask import Flask, jsonify
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from flask_cors import CORS
import os

load_dotenv()

s3_client = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION"),
)
app = Flask(__name__)
CORS(app)


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


if __name__ == "__main__":
    app.run(debug=True)
