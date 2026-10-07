from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
import routes
import sockets
from data import fetch_stats
from repo_search import sync_repos

load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

routes.register(app, socketio)
sockets.register(socketio)

scheduler = BackgroundScheduler()
scheduler.add_job(fetch_stats, "interval", seconds=30)
scheduler.add_job(sync_repos, "interval", hours=1)
scheduler.start()
sync_repos()  # populate on boot rather than waiting for the first hourly tick

if __name__ == "__main__":
    socketio.run(app, debug=True, use_reloader=False)
