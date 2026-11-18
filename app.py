from flask import Flask, render_template, request, jsonify

from scheduler import *

from render import render_gantt

PLIMIT = 19
QLIMIT = 1000

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/schedule', methods=['POST'])
def scheduler():
    response = dict()

    data = request.get_json()
    quantum = data.get('quantum', None)
    processes = data.get('processes', None)

    try:
        quantum = int(quantum)

        if quantum < 1 or quantum > QLIMIT or len(processes) > PLIMIT or len(processes) < 1:
            return jsonify(response), 422

        for i in range(len(processes)):
            processes[i] = Process(i+1, processes[i]['arrival'], processes[i]['burst'])
    except:
        return jsonify(dict(status='error', message='Invalid data')), 400

    sres = Scheduler(quantum, *processes).simulate()
    response['avg_waiting'] = sres.avg_waiting_time
    response['svg'] = render_gantt(sres)

    return jsonify(response), 200

if __name__ == '__main__':
    app.run()