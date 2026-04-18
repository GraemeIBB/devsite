from flask_socketio import emit

crashout_minutes = 0


def set_and_broadcast(socketio, minutes):
    global crashout_minutes
    crashout_minutes = int(minutes)
    socketio.emit("crashout_update", {"minutes": crashout_minutes})


def register(socketio):
    @socketio.on("connect")
    def handle_connect():
        emit("crashout_update", {"minutes": crashout_minutes})
