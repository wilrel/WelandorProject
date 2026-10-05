'use client';

import { useMemo, useState } from 'react';
import type { DailySales } from '@/lib/types';
import { formatCompact, formatNumber, formatRupiah, formatShortDate } from '@/lib/format';

const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };

function niceMax(value: number) {
  if (value <= 0) return 100000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4)! * magnitude;
  return Math.ceil(value / step) * step;
}

/** Single-series daily revenue bars with a per-bar hover tooltip. */
export default function SalesChart({ data }: { data: DailySales[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;

  const { max, ticks } = useMemo(() => {
    const top = niceMax(Math.max(...data.map((d) => d.revenue), 0));
    return { max: top, ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => t * top) };
  }, [data]);

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(data.length, 1);
  const gap = 2;
  const barW = Math.max(slot - gap, 1);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(data.length / 8);
  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Grafik omzet harian">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 text-[10px]">
              {formatCompact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + gap / 2;
          const h = Math.max(y(0) - y(d.revenue), d.revenue > 0 ? 2 : 0);
          const r = Math.min(4, barW / 2, h);
          const top = y(0) - h;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Full-height hit target, larger than the bar itself */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`}
                  className={hover === null || hover === i ? 'fill-indigo-500' : 'fill-indigo-200'}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {formatShortDate(d.date)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth={1} />
      </svg>

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((PAD.left + (hover + 0.5) * slot) / width) * 100}%` }}
        >
          <p className="mb-1 font-semibold text-slate-900">{formatShortDate(hovered.date)}</p>
          <div className="flex justify-between text-slate-600"><span>Omzet</span><span className="font-medium text-slate-900">{formatRupiah(hovered.revenue)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Laba kotor</span><span className="font-medium text-slate-900">{formatRupiah(hovered.profit)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Transaksi</span><span className="font-medium text-slate-900">{formatNumber(hovered.transactions)}</span></div>
        </div>
      )}
    </div>
  );
}
