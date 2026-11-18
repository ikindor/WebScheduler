from dataclasses import dataclass, replace
from collections import deque

@dataclass
class Process:
    id: int
    arrival_time: int
    burst_time: int

@dataclass
class Segment:
    pid: int
    start: int
    end: int

@dataclass
class SimulationResult:
    segments: list[Segment]
    avg_waiting_time: float

class Scheduler:
    def __init__(self, quantum: int, *processes:Process):
        self.processes = {p.id: p for p in processes}
        self.quantum = quantum

    @classmethod
    def from_string(cls, table: str):
        # формат ввода: ID, AT, BT
        quantum, *lines = table.strip().splitlines()

        processes = (Process(*map(int, line.split())) for line in lines if line.strip())
        return cls(int(quantum), *processes)



    def simulate(self) -> SimulationResult:
        segments = list()
        waiting_time = 0

        processes = [replace(p) for p in self.processes.values()]
        processes = deque(sorted(processes, key=lambda p: p.arrival_time))
        sequence = deque()
        time = 0

        while processes or sequence:
            # в простое pid = -1
            if not sequence:
                segments.append(Segment(pid=-1, start=time, end=processes[0].arrival_time))
                time = processes[0].arrival_time
                sequence.appendleft(processes.popleft())

            p = sequence.popleft()
            s = Segment(pid=p.id, start=time, end=time)

            time += min(self.quantum, p.burst_time)
            s.end = time
            p.burst_time -= s.end - s.start

            # если идут подряд два сегмента с одинаковым pid - склеиваем
            if segments and segments[-1].pid == s.pid:
                segments[-1].end = time
            else:
                segments.append(s)

            while processes and processes[0].arrival_time <= time:
                sequence.append(processes.popleft())

            if p.burst_time == 0:
                waiting_time += time - p.arrival_time - self.processes[p.id].burst_time
                continue
            sequence.append(p)

        if segments[0].end == segments[0].start:
            segments.pop(0)
        return SimulationResult(segments=segments, avg_waiting_time=waiting_time/len(self.processes))

if __name__ == '__main__':
    import render
    t = """
3
1 0 5
2 1 4
3 2 2
4 4 6 
"""
    render.render_gantt(Scheduler.from_string(t).simulate())
