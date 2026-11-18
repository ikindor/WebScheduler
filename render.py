import io
from matplotlib.figure import Figure
from matplotlib.ticker import MaxNLocator
from scheduler import SimulationResult


def render_gantt(sres: SimulationResult) -> str:
    segments = sres.segments
    n = max(s.pid for s in segments)

    fig = Figure(figsize=(8, 0.5*n + 1.3))
    ax = fig.subplots()

    for s in segments:
        if s.pid == -1:
            continue
        i = s.pid - 1
        ax.barh(i, s.end - s.start, left=s.start,
                color="C" + str(i % 10), edgecolor="black")

    ax.set_yticks(range(n))
    ax.set_yticklabels(["P" + str(i + 1) for i in range(n)])
    ax.invert_yaxis()
    ax.set_xlim(0, max(s.end for s in segments))
    ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    ax.set_xlabel("Time")
    ax.grid(axis="x", alpha=0.3)
    fig.tight_layout()

    buf = io.StringIO()
    fig.savefig(buf, format="svg")
    return buf.getvalue()