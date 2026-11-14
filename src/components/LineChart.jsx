import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from "chart.js";

/** Dashed vertical line at a (fractional) category position: options.plugins.eventLine = { at, label }. */
const eventLine = {
  id: "eventLine",
  afterDatasetsDraw(chart, _args, opts) {
    if (opts?.at == null) return;
    const { ctx, chartArea: a, scales: { x } } = chart;
    const i = Math.floor(opts.at), f = opts.at - i;
    const px = x.getPixelForValue(i) + f * (x.getPixelForValue(i + 1) - x.getPixelForValue(i));
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, a.top);
    ctx.lineTo(px, a.bottom);
    ctx.stroke();
    if (opts.label) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(opts.label, px, a.top + 10);
    }
    ctx.restore();
  },
};

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend, eventLine);
Chart.defaults.color = "#94a0c4";
Chart.defaults.borderColor = "rgba(148,160,196,.15)";
Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.font.size = 11;

/** Thin Chart.js line chart. The chart is created once and updated in place when props change. */
export default function LineChart({ labels, datasets, options, onPointClick }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const clickRef = useRef(onPointClick);
  clickRef.current = onPointClick;

  useEffect(() => {
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels: [], datasets: [] },
      options: {},
    });
    return () => chartRef.current.destroy();
  }, []);

  useEffect(() => {
    const c = chartRef.current;
    c.data.labels = labels;
    c.data.datasets = datasets;
    c.options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      ...options,
      onClick: (_, els) => els.length && clickRef.current?.(els[0].index),
    };
    c.update();
  }, [labels, datasets, options]);

  return (
    <div className="chart-box">
      <canvas ref={canvasRef} />
    </div>
  );
}
