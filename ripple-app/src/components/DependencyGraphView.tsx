import { useMemo, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Radio, Sparkles, AlertTriangle } from 'lucide-react';
import type { Booking, ImpactedBooking } from '../lib/types';
import type { Itinerary } from '../lib/types';
import { useAppState } from '../App';

// ---------------------------------------------------------------------------
// Layout Constants
// ---------------------------------------------------------------------------
const NODE_W = 208;
const NODE_H = 76;
const COL_GAP = 88;   // horizontal space between columns (room for bezier + label)
const ROW_GAP = 22;   // vertical gap between nodes in same column
const PAD_X = 28;
const PAD_Y = 28;

// ---------------------------------------------------------------------------
// Status color palette (mirrors BookingCard.tsx STATUS_CONFIG / index.css tokens)
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, { edge: string; text: string; bg: string; border: string }> = {
  confirmed:  { edge: 'var(--color-confirmed)',  text: 'var(--color-confirmed)',  bg: 'var(--color-confirmed-bg)',  border: 'var(--color-confirmed-border)' },
  'at-risk':  { edge: 'var(--color-at-risk)',    text: 'var(--color-at-risk)',    bg: 'var(--color-at-risk-bg)',    border: 'var(--color-at-risk-border)' },
  disrupted:  { edge: 'var(--color-disrupted)',  text: 'var(--color-disrupted)',  bg: 'var(--color-disrupted-bg)', border: 'var(--color-disrupted-border)' },
  recovered:  { edge: 'var(--color-confirmed)',  text: 'var(--color-confirmed)',  bg: 'var(--color-confirmed-bg)', border: 'var(--color-confirmed-border)' },
  cancelled:  { edge: 'var(--color-cancelled)',  text: 'var(--color-cancelled)',  bg: 'var(--color-cancelled-bg)', border: 'var(--color-cancelled-border)' },
};

// ---------------------------------------------------------------------------
// Type icon labels (compact monospace, no external icons needed in SVG)
// ---------------------------------------------------------------------------
const TYPE_SIGIL: Record<Booking['type'], string> = {
  flight:   'FLT',
  train:    'TRN',
  hotel:    'HTL',
  transfer: 'XFR',
  activity: 'ACT',
  event:    'EVT',
};

// ---------------------------------------------------------------------------
// Layout computation — BFS depth assignment
// ---------------------------------------------------------------------------

/** Returns depth (column index) for every booking. Depth = max(dep depths) + 1, roots = 0. */
function computeDepths(bookings: Booking[]): Map<string, number> {
  const depthMap = new Map<string, number>();
  const bookingMap = new Map(bookings.map((b) => [b.id, b]));

  // Process in topological order using iterative BFS-like pass
  // We repeat until stable (handles arbitrary ordering in the input array)
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of bookings) {
      let d = 0;
      for (const depId of b.dependsOn) {
        const depDepth = depthMap.get(depId);
        // If dependency not yet resolved, skip this iteration — will re-run
        if (depDepth === undefined) { d = -1; break; }
        d = Math.max(d, depDepth + 1);
      }
      if (d === -1) continue; // dependency not yet processed
      const existing = depthMap.get(b.id);
      if (existing !== d) {
        depthMap.set(b.id, d);
        changed = true;
      }
    }
  }

  // Fallback: any booking not resolved gets depth 0
  for (const b of bookings) {
    if (!depthMap.has(b.id)) depthMap.set(b.id, 0);
  }

  // Suppress unused var warning for bookingMap
  void bookingMap;

  return depthMap;
}

interface NodePosition { x: number; y: number }

/** Assign pixel positions given depths. Within each column, sort by startTime. */
function assignPositions(
  bookings: Booking[],
  depthMap: Map<string, number>
): Map<string, NodePosition> {
  // Group bookings by depth/column
  const columns = new Map<number, Booking[]>();
  for (const b of bookings) {
    const d = depthMap.get(b.id) ?? 0;
    const col = columns.get(d) ?? [];
    col.push(b);
    columns.set(d, col);
  }

  // Sort each column by startTime ascending
  for (const col of columns.values()) {
    col.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  const posMap = new Map<string, NodePosition>();
  for (const [depth, col] of columns.entries()) {
    const x = PAD_X + depth * (NODE_W + COL_GAP);
    col.forEach((b, rowIdx) => {
      const y = PAD_Y + rowIdx * (NODE_H + ROW_GAP);
      posMap.set(b.id, { x, y });
    });
  }

  return posMap;
}

/** Total canvas dimensions from all node positions */
function computeCanvasSize(posMap: Map<string, NodePosition>): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const { x, y } of posMap.values()) {
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
  }
  return { width: maxX + PAD_X, height: maxY + PAD_Y };
}

// ---------------------------------------------------------------------------
// Edge classification helpers
// ---------------------------------------------------------------------------
type EdgeStatus = 'normal' | 'at-risk' | 'disrupted';

function getEdgeStatus(
  depId: string,
  bookingId: string,
  disruptedSourceId: string | null,
  impactedMap: Map<string, ImpactedBooking>,
  downstreamOfSource: Set<string>
): EdgeStatus {
  // Edge is disrupted-colored if it originates from the source disruption node
  if (depId === disruptedSourceId || downstreamOfSource.has(depId)) {
    const impacted = impactedMap.get(bookingId);
    if (impacted?.severity === 'broken') return 'disrupted';
    if (impacted) return 'at-risk';
    // If downstream of source but not in impactedBookings, still mildly highlight
    if (downstreamOfSource.has(depId)) return 'at-risk';
  }
  return 'normal';
}

/** BFS to collect all node IDs downstream of the disruption source */
function collectDownstream(
  sourceId: string,
  bookings: Booking[]
): Set<string> {
  // Build reverse dep graph
  const reverse = new Map<string, string[]>();
  for (const b of bookings) reverse.set(b.id, []);
  for (const b of bookings) {
    for (const depId of b.dependsOn) {
      const arr = reverse.get(depId) ?? [];
      arr.push(b.id);
      reverse.set(depId, arr);
    }
  }
  const visited = new Set<string>();
  const queue = [sourceId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nxt of (reverse.get(cur) ?? [])) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return visited;
}

// ---------------------------------------------------------------------------
// Buffer label formatter
// ---------------------------------------------------------------------------
function fmtBuffer(minutes: number): string {
  if (minutes === 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// SVG Edge component
// ---------------------------------------------------------------------------
interface EdgeProps {
  x1: number; y1: number;
  x2: number; y2: number;
  bufferMinutes: number;
  status: EdgeStatus;
  edgeId: string;
  isSimulatedActive?: boolean;
}

function GraphEdge({ x1, y1, x2, y2, bufferMinutes, status, edgeId, isSimulatedActive }: EdgeProps) {
  // Cubic bezier: from right-center of dep to left-center of booking
  const cx1 = x1 + (x2 - x1) * 0.45;
  const cy1 = y1;
  const cx2 = x1 + (x2 - x1) * 0.55;
  const cy2 = y2;
  const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

  // Midpoint of bezier (approx at t=0.5)
  const mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
  const my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;

  const strokeColor =
    isSimulatedActive
      ? '#9E2B25'
      : status === 'disrupted'
      ? 'var(--color-disrupted)'
      : status === 'at-risk'
      ? 'var(--color-at-risk)'
      : '#DEDAD2';

  const isAnimated = isSimulatedActive || status !== 'normal';

  const label = fmtBuffer(bufferMinutes);

  return (
    <g>
      {/* Animated background path for cascade effect */}
      {isAnimated && (
        <path
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={isSimulatedActive ? 2.5 : 1.5}
          strokeDasharray="6 5"
          opacity={isSimulatedActive ? 0.8 : 0.35}
          style={{
            animation: 'graph-edge-march 1.1s linear infinite',
          }}
        />
      )}
      {/* Main edge path */}
      <path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isSimulatedActive ? 2 : isAnimated ? 1.5 : 1}
        opacity={isAnimated ? 0.95 : 1}
      />
      {/* Animated traveling ripple particle pulse */}
      {isSimulatedActive && (
        <circle r="4" fill="#9E2B25" opacity="0.95">
          <animateMotion
            path={d}
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {/* Arrowhead at destination */}
      <polygon
        points={`${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}`}
        fill={strokeColor}
        opacity={0.8}
      />
      {/* Buffer label */}
      {label && (
        <g>
          <rect
            x={mx - 20}
            y={my - 8}
            width={40}
            height={14}
            rx={1}
            fill="var(--color-bg-base)"
            stroke={strokeColor}
            strokeWidth={0.5}
            opacity={0.92}
          />
          <text
            x={mx}
            y={my + 3}
            textAnchor="middle"
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
            fill={status === 'normal' && !isSimulatedActive ? '#8896A4' : strokeColor}
            fontWeight={status === 'normal' && !isSimulatedActive ? 400 : 600}
          >
            {label}
          </text>
        </g>
      )}
      {/* Invisible wider hit area (for future tooltip) */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={12} data-edge-id={edgeId} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Single Node component
// ---------------------------------------------------------------------------
interface NodeProps {
  booking: Booking;
  x: number;
  y: number;
  isDisruptionSource: boolean;
  impactedBooking?: ImpactedBooking;
  isSimulatedOrigin?: boolean;
  isSimulatedAtRisk?: boolean;
  isSimulatedBroken?: boolean;
  onClick?: () => void;
}

function GraphNode({
  booking,
  x,
  y,
  isDisruptionSource,
  impactedBooking,
  isSimulatedOrigin,
  isSimulatedAtRisk,
  isSimulatedBroken,
  onClick,
}: NodeProps) {
  const isBroken = impactedBooking?.severity === 'broken' || isSimulatedBroken;
  const isAtRisk = impactedBooking?.severity === 'at-risk' || isSimulatedAtRisk;
  const isCompound = impactedBooking?.compoundDisruptionCount === 2;

  let effectiveStatus: Booking['status'] = booking.status;
  if (isDisruptionSource || isSimulatedOrigin) effectiveStatus = 'disrupted';
  else if (isBroken) effectiveStatus = 'disrupted';
  else if (isAtRisk) effectiveStatus = 'at-risk';

  const colors = STATUS_COLORS[effectiveStatus] ?? STATUS_COLORS.confirmed;

  // Truncate title to fit node width
  const shortTitle = booking.title.length > 22
    ? booking.title.slice(0, 21) + '…'
    : booking.title;

  // Short time label: "06:30" from ISO
  const timeStr = new Date(booking.startTime).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });

  const statusLabel = isSimulatedOrigin
    ? 'ORIGIN PULSE'
    : isSimulatedBroken
    ? 'CASCADE BREAK'
    : isSimulatedAtRisk
    ? 'BUFFER THREAT'
    : isDisruptionSource
    ? 'INCIDENT'
    : isBroken
    ? 'BROKEN'
    : isAtRisk
    ? 'AT RISK'
    : effectiveStatus.toUpperCase();

  return (
    <div
      id={`graph-node-${booking.id}`}
      onClick={onClick}
      className="absolute cursor-pointer group"
      style={{
        left: x,
        top: y,
        width: NODE_W,
        height: NODE_H,
      }}
      title="Click to trigger animated ripple cascade from this booking"
    >
      {/* Concentric Pulse Ring for Simulated Disruption Origin */}
      {isSimulatedOrigin && (
        <div
          className="absolute -inset-1 rounded-[4px] border-2 border-[#9E2B25] animate-ping opacity-60 pointer-events-none"
        />
      )}

      <div
        className="transition-all duration-150 group-hover:border-[#17212B] group-hover:shadow-md"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: isDisruptionSource || isBroken || isSimulatedOrigin
            ? 'var(--color-disrupted-bg)'
            : isAtRisk
            ? 'var(--color-at-risk-bg)'
            : 'var(--color-bg-surface)',
          border: isSimulatedOrigin
            ? '2px solid #9E2B25'
            : isSimulatedBroken
            ? '1.5px solid #9E2B25'
            : isSimulatedAtRisk
            ? '1.5px solid #B8552F'
            : `1px solid ${colors.border}`,
          borderLeft: `3px solid ${isSimulatedOrigin ? '#9E2B25' : colors.edge}`,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '8px 10px',
          gap: 4,
          boxSizing: 'border-box',
          // Compound nodes: dashed double-ring outline
          ...(isCompound
            ? {
                outline: '2px dashed #7A1E1A',
                outlineOffset: '2px',
                boxShadow: '0 0 0 4px rgba(122,30,26,0.12)',
              }
            : {}),
          // Subtle hazard pattern for disrupted nodes
          ...(isDisruptionSource || isBroken || isSimulatedOrigin
            ? {
                backgroundImage:
                  'repeating-linear-gradient(-45deg, rgba(158,43,37,0.05), rgba(158,43,37,0.05) 8px, transparent 8px, transparent 16px)',
              }
            : {}),
        }}
      >
        {/* Row 1: type sigil + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: isCompound ? '#FFF' : colors.text,
              backgroundColor: isCompound ? '#7A1E1A' : colors.bg,
              border: `1px solid ${isCompound ? '#7A1E1A' : colors.border}`,
              borderRadius: 2,
              padding: '1px 4px',
              lineHeight: '1.3',
              flexShrink: 0,
            }}
            title={isCompound ? 'Affected by 2 simultaneous disruptions' : undefined}
          >
            {isCompound ? '×2' : TYPE_SIGIL[booking.type]}
          </span>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: isSimulatedOrigin ? '#9E2B25' : colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '68%',
              textAlign: 'right',
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Row 2: booking title */}
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-main)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.3',
          }}
          title={booking.title}
        >
          {shortTitle}
        </div>

        {/* Row 3: departure time */}
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: 'var(--color-text-subtle)',
            lineHeight: '1.2',
          }}
        >
          {timeStr}
          {booking.bufferMinutes > 0 && (
            <span style={{ marginLeft: 6, color: isAtRisk || isBroken ? colors.text : '#8896A4' }}>
              · {booking.bufferMinutes}m req
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DependencyGraphView component
// ---------------------------------------------------------------------------
interface Props {
  itinerary: Itinerary;
}

export default function DependencyGraphView({ itinerary }: Props) {
  const { activeDisruptions, impactedBookings } = useAppState();
  // Backward-compat alias: use first disruption for edge coloring (both disruptions
  // are already represented in impactedBookings via detectCombinedImpact)
  const activeDisruption = activeDisruptions[0] ?? null;

  const bookings = itinerary.bookings;

  // Build impacted map
  const impactedMap = useMemo(() => {
    const m = new Map<string, ImpactedBooking>();
    for (const ib of impactedBookings) m.set(ib.booking.id, ib);
    return m;
  }, [impactedBookings]);

  // Disruption source
  const disruptedSourceId = activeDisruption?.bookingId ?? null;

  // All disruption source IDs (supports 1 or 2 concurrent disruptions)
  const disruptedSourceIds = useMemo(
    () => new Set(activeDisruptions.map((d) => d.bookingId)),
    [activeDisruptions]
  );

  // Downstream nodes from ALL disruption sources (for edge coloring)
  const downstreamOfSource = useMemo<Set<string>>(() => {
    if (activeDisruptions.length === 0) return new Set();
    const allDownstream = new Set<string>();
    for (const d of activeDisruptions) {
      for (const id of collectDownstream(d.bookingId, bookings)) {
        allDownstream.add(id);
      }
    }
    return allDownstream;
  }, [activeDisruptions, bookings]);

  // Compute layout
  const depthMap = useMemo(() => computeDepths(bookings), [bookings]);
  const posMap = useMemo(() => assignPositions(bookings, depthMap), [bookings, depthMap]);
  const { width: canvasW, height: canvasH } = useMemo(() => computeCanvasSize(posMap), [posMap]);

  // Collect all edges: (dep → booking) for each booking's dependsOn entries
  const edges = useMemo(() => {
    const result: Array<{
      depId: string;
      bookingId: string;
      bufferMinutes: number;
      status: EdgeStatus;
      key: string;
    }> = [];

    for (const b of bookings) {
      for (const depId of b.dependsOn) {
        const status = getEdgeStatus(depId, b.id, disruptedSourceId, impactedMap, downstreamOfSource);
        result.push({
          depId,
          bookingId: b.id,
          bufferMinutes: b.bufferMinutes,
          status,
          key: `${depId}→${b.id}`,
        });
      }
    }
    return result;
  }, [bookings, disruptedSourceId, impactedMap, downstreamOfSource]);

  const bookingMap = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  // ---------------------------------------------------------------------------
  // INTERACTIVE CASCADE SIMULATION ENGINE
  // ---------------------------------------------------------------------------
  const [simOriginId, setSimOriginId] = useState<string | null>(null);
  const [simStep, setSimStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Compute forward BFS tiers from simOriginId
  const simTiers = useMemo<string[][]>(() => {
    if (!simOriginId) return [];
    const tiers: string[][] = [[simOriginId]];
    const visited = new Set<string>([simOriginId]);

    const reverse = new Map<string, string[]>();
    for (const b of bookings) {
      for (const dep of b.dependsOn) {
        const downstream = reverse.get(dep) ?? [];
        downstream.push(b.id);
        reverse.set(dep, downstream);
      }
    }

    let currentTier = [simOriginId];
    while (currentTier.length > 0) {
      const nextTier: string[] = [];
      for (const id of currentTier) {
        const children = reverse.get(id) ?? [];
        for (const childId of children) {
          if (!visited.has(childId)) {
            visited.add(childId);
            nextTier.push(childId);
          }
        }
      }
      if (nextTier.length > 0) {
        tiers.push(nextTier);
      }
      currentTier = nextTier;
    }

    return tiers;
  }, [simOriginId, bookings]);

  const maxSimStep = Math.max(0, simTiers.length - 1);

  // Auto-play timer: advances cascade step by step
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSimStep((prev) => {
        if (prev >= maxSimStep) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1300);
    return () => clearInterval(timer);
  }, [isPlaying, maxSimStep]);

  const handleNodeClick = useCallback((id: string) => {
    setSimOriginId(id);
    setSimStep(0);
    setIsPlaying(true);
  }, []);

  const handleResetSim = useCallback(() => {
    setSimOriginId(null);
    setSimStep(0);
    setIsPlaying(false);
  }, []);

  // Checks if an edge between depId and targetId is active in current cascade step
  const checkEdgeSimulated = useCallback(
    (depId: string, targetId: string): boolean => {
      if (!simOriginId || simStep < 1) return false;
      for (let s = 1; s <= simStep; s++) {
        const parentTier = simTiers[s - 1] ?? [];
        const childTier = simTiers[s] ?? [];
        if (parentTier.includes(depId) && childTier.includes(targetId)) {
          return true;
        }
      }
      return false;
    },
    [simOriginId, simStep, simTiers]
  );

  // Minimum height for the scroll area — give breathing room even for short graphs
  const minHeight = Math.max(canvasH, 180);

  return (
    <div
      style={{
        borderRadius: 2,
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-base)',
      }}
    >
      {/* Top Cascade Simulator Controller Bar */}
      <div className="bg-[#F7F4EE] border-b border-[#DEDAD2] p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#17212B] text-white flex items-center gap-1.5">
            <Radio size={11} className={isPlaying ? 'text-[#E5A93C] animate-pulse' : 'text-[#8896A4]'} />
            CASCADE SIMULATOR
          </span>
          {simOriginId ? (
            <span className="text-xs font-bold text-[#17212B]">
              Origin: {bookingMap.get(simOriginId)?.title.split(' — ')[0]}
              <span className="text-2xs font-normal text-[#4A5568] ml-2">
                (Step {simStep} of {maxSimStep})
              </span>
            </span>
          ) : (
            <span className="text-2xs text-[#4A5568]">
              Click any booking node below to simulate a disruption cascade in real time
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {simOriginId && (
            <>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                type="button"
                className="px-2.5 py-1 rounded-[2px] border border-[#DEDAD2] hover:border-[#17212B] bg-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>
              <button
                onClick={() => setSimStep((s) => Math.max(0, s - 1))}
                disabled={simStep === 0}
                type="button"
                className="px-2 py-1 rounded-[2px] border border-[#DEDAD2] hover:border-[#17212B] bg-white text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                PREV
              </button>
              <button
                onClick={() => setSimStep((s) => Math.min(maxSimStep, s + 1))}
                disabled={simStep >= maxSimStep}
                type="button"
                className="px-2 py-1 rounded-[2px] border border-[#DEDAD2] hover:border-[#17212B] bg-white text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                NEXT
              </button>
              <button
                onClick={handleResetSim}
                type="button"
                title="Reset Simulation"
                className="p-1 rounded-[2px] border border-[#DEDAD2] hover:border-[#17212B] bg-white text-[#4A5568] hover:text-[#17212B] cursor-pointer"
              >
                <RotateCcw size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch' as never,
          backgroundColor: 'var(--color-bg-base)',
          // Subtle grid background — manifest/technical aesthetic
          backgroundImage:
            'linear-gradient(var(--color-border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0',
          backgroundAttachment: 'local',
        }}
        aria-label="Itinerary dependency graph"
        role="img"
      >
        {/* Canvas wrapper: nodes are absolutely positioned within this */}
        <div
          style={{
            position: 'relative',
            width: canvasW,
            minHeight,
            height: canvasH,
            flexShrink: 0,
          }}
        >
          {/* SVG layer for edges (behind nodes) */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
            width={canvasW}
            height={Math.max(canvasH, minHeight)}
            aria-hidden="true"
          >
            {/* Edge march animation keyframe — injected inline once */}
            <defs>
              <style>{`
                @keyframes graph-edge-march {
                  to { stroke-dashoffset: -22; }
                }
              `}</style>
            </defs>

            {edges.map(({ depId, bookingId, bufferMinutes, status, key }) => {
              const depPos = posMap.get(depId);
              const bookingPos = posMap.get(bookingId);
              if (!depPos || !bookingPos) return null;

              // Right-center of dep node → left-center of booking node
              const x1 = depPos.x + NODE_W;
              const y1 = depPos.y + NODE_H / 2;
              const x2 = bookingPos.x;
              const y2 = bookingPos.y + NODE_H / 2;

              const isSimulatedActive = checkEdgeSimulated(depId, bookingId);

              return (
                <GraphEdge
                  key={key}
                  edgeId={key}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  bufferMinutes={bufferMinutes}
                  status={status}
                  isSimulatedActive={isSimulatedActive}
                />
              );
            })}
          </svg>

          {/* Node layer */}
          {bookings.map((b) => {
            const pos = posMap.get(b.id);
            if (!pos) return null;

            // Check simulation status for this node
            const isSimulatedOrigin = b.id === simOriginId;
            let isSimulatedAtRisk = false;
            let isSimulatedBroken = false;

            if (simOriginId && simStep > 0) {
              for (let s = 1; s <= simStep; s++) {
                const tier = simTiers[s] ?? [];
                if (tier.includes(b.id)) {
                  if (s === simStep) isSimulatedAtRisk = true;
                  else isSimulatedBroken = true;
                }
              }
            }

            return (
              <GraphNode
                key={b.id}
                booking={b}
                x={pos.x}
                y={pos.y}
                isDisruptionSource={disruptedSourceIds.has(b.id)}
                impactedBooking={impactedMap.get(b.id)}
                isSimulatedOrigin={isSimulatedOrigin}
                isSimulatedAtRisk={isSimulatedAtRisk}
                isSimulatedBroken={isSimulatedBroken}
                onClick={() => handleNodeClick(b.id)}
              />
            );
          })}

        {/* Empty state fallback */}
        {bookings.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: 'var(--color-text-subtle)',
              letterSpacing: '0.1em',
            }}
          >
            NO SEGMENTS IN THIS ITINERARY
          </div>
        )}
      </div>
      </div>

      {/* Legend strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '8px 14px',
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-surface)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          color: 'var(--color-text-subtle)',
          letterSpacing: '0.08em',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>LEGEND</span>
        {[
          { color: 'var(--color-confirmed)', label: 'CONFIRMED' },
          { color: 'var(--color-at-risk)',   label: 'AT RISK (CASCADE)' },
          { color: 'var(--color-disrupted)', label: 'DISRUPTED / BROKEN' },
          { color: '#DEDAD2',               label: 'DEPENDENCY EDGE' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 20,
                height: 2,
                backgroundColor: color,
                display: 'inline-block',
                borderRadius: 1,
              }}
            />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-subtle)' }}>
          EDGE LABELS = REQUIRED BUFFER
        </span>
      </div>
    </div>
  );
}
