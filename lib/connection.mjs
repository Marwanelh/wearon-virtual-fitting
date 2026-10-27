export function connectionSummary(report) {
  if (!report || report.warmingUp) return 'Measuring connection…';
  const { fps, rttMs, packetLoss } = report.metrics;
  const number = (value, scale = 1) => Number.isFinite(value) && value >= 0 ? Math.round(value * scale) : '—';
  const quality = { good: 'Good', fair: 'Fair', poor: 'Poor', critical: 'Critical' }[report.quality] || 'Unknown';
  return `${quality} connection · ${number(fps)} fps · ${number(rttMs)} ms network round trip · ${number(packetLoss, 100)}% upload packet loss`;
}
