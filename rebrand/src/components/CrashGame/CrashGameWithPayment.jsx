import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Rocket,
  Volume2,
  VolumeX,
  Wallet,
  Users,
  History,
  Plus,
  Minus,
  Zap,
  TrendingUp,
  ShieldCheck,
  DollarSign,
} from "lucide-react";

const GROWTH_RATE = 0.16;
const BETTING_SECONDS = 6;
const CRASHED_PAUSE_MS = 2600;
const MAX_TRAIL_POINTS = 400;

const QUICK_AMOUNTS = [50, 100, 500, 1000];
const FAKE_NAMES = [
  "Wanjiru_88", "Kip_Rocket", "MamaAce", "TzFlyer", "Odongo_K", "NightOwl",
  "Zara_Bets", "Njoroge21", "LuckyDee", "AviatorKe", "Msichana", "BaridiBoy",
];

function generateCrashPoint() {
  const E = Math.pow(2, 32);
  const h = Math.floor(Math.random() * E);
  if (h % 33 === 0) return 1.0;
  const point = Math.floor((100 * E - h) / (E - h)) / 100;
  return Math.max(1.0, point);
}

function fmtMultiplier(m) {
  return `${m.toFixed(2)}x`;
}

function fmtMoney(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

function randomName() {
  return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)] + Math.floor(Math.random() * 90 + 10);
}

function historyColor(m) {
  if (m < 1.5) return { bg: "#2A1420", text: "#FF5C82", ring: "#4A1D2E" };
  if (m < 2) return { bg: "#1E1533", text: "#B79CFF", ring: "#33244F" };
  if (m < 10) return { bg: "#231A40", text: "#9D7CFF", ring: "#3A2A66" };
  return { bg: "#332411", text: "#FFC94A", ring: "#4F3B15" };
}

function useBeeper(muted) {
  const ctxRef = useRef(null);
  const ensure = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    return ctxRef.current;
  };
  const beep = useCallback(
    (freq, duration, type = "sine", gain = 0.05) => {
      if (muted) return;
      const ctx = ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration);
    },
    [muted]
  );
  return beep;
}

function BetPanel({ index, slot, phase, balance, onChangeAmount, onPlace, onCashOut, liveMultiplier }) {
  const isFlying = phase === "flying";
  const canPlace = phase === "betting" && !slot.queued;
  const potential = slot.active && !slot.cashedOut ? slot.amount * liveMultiplier : 0;

  return (
    <div style={{
      background: "#131A2C",
      border: "1px solid #232C48",
      borderRadius: 14,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          disabled={!canPlace}
          onClick={() => onChangeAmount(Math.max(10, Math.round((slot.amount - 50) * 100) / 100))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid #232C48",
            background: canPlace ? "#0E1424" : "#0a0d17",
            color: canPlace ? "#EDEFF7" : "#4A5170",
            cursor: canPlace ? "pointer" : "default",
          }}
        >
          <Minus size={14} />
        </button>
        <div style={{
          flex: 1,
          background: "#0E1424",
          border: "1px solid #232C48",
          borderRadius: 10,
          padding: "8px 10px",
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 18,
          fontWeight: 600,
          color: "#EDEFF7",
        }}>
          KES {slot.amount.toFixed(0)}
        </div>
        <button
          disabled={!canPlace}
          onClick={() => onChangeAmount(Math.round((slot.amount + 50) * 100) / 100)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid #232C48",
            background: canPlace ? "#0E1424" : "#0a0d17",
            color: canPlace ? "#EDEFF7" : "#4A5170",
            cursor: canPlace ? "pointer" : "default",
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            disabled={!canPlace}
            onClick={() => onChangeAmount(amt)}
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid #232C48",
              background: "#0E1424",
              color: canPlace ? "#B7BEDA" : "#4A5170",
              cursor: canPlace ? "pointer" : "default",
            }}
          >
            {amt}
          </button>
        ))}
      </div>

      {potential > 0 && (
        <div style={{
          background: "#1A2B3D",
          borderRadius: 8,
          padding: "8px 10px",
          textAlign: "center",
          fontSize: 12,
          color: "#7CFF7C",
          fontWeight: 600,
        }}>
          Potential: KES {fmtMoney(potential)}
        </div>
      )}

      <button
        disabled={!canPlace || slot.amount > balance}
        onClick={() => onPlace(index)}
        style={{
          padding: "10px",
          borderRadius: 10,
          border: "none",
          background: canPlace && slot.amount <= balance ? "#7C5CFF" : "#4A3D7D",
          color: canPlace && slot.amount <= balance ? "#EDEFF7" : "#8891AA",
          fontWeight: 600,
          cursor: canPlace && slot.amount <= balance ? "pointer" : "default",
        }}
      >
        {slot.active ? "Placed" : "Place Bet"}
      </button>

      {slot.active && !slot.cashedOut && phase === "flying" && (
        <button
          onClick={() => onCashOut(index)}
          style={{
            padding: "10px",
            borderRadius: 10,
            border: "2px solid #4ADE9A",
            background: "#0E1424",
            color: "#4ADE9A",
            fontWeight: 600,
            cursor: "pointer",
            animation: "pulse 0.5s infinite",
          }}
        >
          Cash Out: KES {fmtMoney(potential)}
        </button>
      )}
    </div>
  );
}

export default function CrashGameWithPayment() {
  const [phase, setPhase] = useState("betting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [countdown, setCountdown] = useState(BETTING_SECONDS);
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(false);
  const [loading, setLoading] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [gameStats, setGameStats] = useState(null);

  const [slots, setSlots] = useState([
    { amount: 100, active: false, queued: false, cashedOut: false, betId: null },
    { amount: 100, active: false, queued: false, cashedOut: false, betId: null },
  ]);

  const [planePos, setPlanePos] = useState({ x: 40, y: 200, angle: -20 });
  const [camShift, setCamShift] = useState(0);
  const [pathD, setPathD] = useState("");
  const beep = useBeeper(muted);
  const gameLoopRef = useRef(null);

  useEffect(() => {
    fetchBalance();
    fetchStats();
  }, []);

  useEffect(() => {
    if (phase === "betting") {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            startGamePhase();
            return BETTING_SECONDS;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "flying") {
      const startTime = Date.now();
      const crashPoint = generateCrashPoint();

      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const m = Math.exp(GROWTH_RATE * elapsed);

        if (m >= crashPoint) {
          setPhase("crashed");
          setMultiplier(crashPoint);
          beep(100, 0.5);
          setFlash(true);
          setTimeout(() => setFlash(false), 100);
          settleRound(crashPoint);
          return;
        }

        setMultiplier(m);
        updatePlanePos(m);
        gameLoopRef.current = requestAnimationFrame(animate);
      };

      gameLoopRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(gameLoopRef.current);
    }
  }, [phase]);

  const updatePlanePos = (m) => {
    const x = Math.log(m) * 120 + 40;
    const y = 400 - Math.log(m) * 80;
    const angle = Math.atan2(-Math.log(m) * 80, Math.log(m) * 120) * (180 / Math.PI) + 90;

    setPlanePos({ x, y, angle });
    setCamShift(Math.max(0, x - 200));

    setPathD((prev) => {
      const points = prev ? prev.split(" L ") : [];
      points.push(`${x} ${y}`);
      if (points.length > MAX_TRAIL_POINTS) points.shift();
      return points.join(" L ");
    });
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/wallet/balance");
      const data = await res.json();
      setBalance(data.balance || 0);
    } catch (e) {
      console.error("Error fetching balance:", e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/crash/stats");
      const data = await res.json();
      setGameStats(data);
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  const startGamePhase = () => {
    setPhase("flying");
    setMultiplier(1.0);
    setPathD("");
    setCountdown(BETTING_SECONDS);
  };

  const changeAmount = (index, amount) => {
    const newSlots = [...slots];
    newSlots[index].amount = Math.max(10, amount);
    setSlots(newSlots);
  };

  const placeBet = async (index) => {
    if (slots[index].amount > balance) {
      alert("Insufficient balance");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/crash/place-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: "current",
          bet_amount: slots[index].amount,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const newSlots = [...slots];
        newSlots[index].active = true;
        newSlots[index].betId = data.bet_id;
        setSlots(newSlots);
        setBalance(data.new_balance);
        beep(800, 0.1);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error("Error placing bet:", e);
    } finally {
      setLoading(false);
    }
  };

  const cashOut = async (index) => {
    const slot = slots[index];
    if (!slot.active || !slot.betId) return;

    setLoading(true);
    try {
      const res = await fetch("/api/crash/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bet_id: slot.betId,
          current_multiplier: multiplier,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const newSlots = [...slots];
        newSlots[index].cashedOut = true;
        newSlots[index].active = false;
        setSlots(newSlots);
        setBalance(data.new_balance);
        beep(1200, 0.2);
      }
    } catch (e) {
      console.error("Error cashing out:", e);
    } finally {
      setLoading(false);
    }
  };

  const settleRound = async (crashPoint) => {
    try {
      await fetch("/api/crash/end-round/current", { method: "POST" });
      setHistory([crashPoint, ...history.slice(0, 19)]);
      setTimeout(() => {
        setPhase("betting");
        setMultiplier(1.0);
        setPathD("");
        setPlanePos({ x: 40, y: 200, angle: -20 });
        setCamShift(0);
        setSlots(slots.map((s) => ({ ...s, active: false, cashedOut: false })));
      }, CRASHED_PAUSE_MS);
    } catch (e) {
      console.error("Error settling round:", e);
    }
  };

  const initiateDeposit = async () => {
    if (!depositAmount || !phone) {
      alert("Enter amount and phone");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments/initiate-stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone,
          amount: parseFloat(depositAmount),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("M-Pesa prompt sent to " + phone);
        setDepositModal(false);
        setTimeout(fetchBalance, 5000);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error("Error initiating deposit:", e);
    } finally {
      setLoading(false);
    }
  };

  const bgGlow = "radial-gradient(circle at 50% 50%, rgba(124,92,255,0.1) 0%, transparent 70%)";

  return (
    <div style={{ background: "#0B0F1C", color: "#EDEFF7", minHeight: "100vh", padding: "20px", fontFamily: "'Sora', sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Rocket size={28} color="#7C5CFF" />
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>JetX Crash</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setMuted(!muted)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1px solid #232C48",
                background: "#131A2C",
                color: "#B7BEDA",
                cursor: "pointer",
              }}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={() => setDepositModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "#131A2C",
                border: "1px solid #232C48",
                borderRadius: 10,
                color: "#FFC94A",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              <DollarSign size={16} /> Deposit
            </button>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#131A2C",
              border: "1px solid #232C48",
              borderRadius: 10,
              padding: "8px 14px",
            }}>
              <Wallet size={16} color="#FFC94A" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14 }}>
                KES {fmtMoney(balance)}
              </span>
            </div>
          </div>
        </div>

        {/* History strip */}
        <div style={{ maxWidth: 1080, margin: "0 auto 12px", display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <History size={14} color="#5A6280" style={{ flexShrink: 0 }} />
          {history.map((h, i) => {
            const c = historyColor(h);
            return (
              <span key={i} style={{
                flexShrink: 0,
                background: c.bg,
                color: c.text,
                border: `1px solid ${c.ring}`,
                borderRadius: 20,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {h.toFixed(2)}x
              </span>
            );
          })}
        </div>

        {/* Main layout */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 14, marginBottom: 14 }}>
          {/* Flight canvas */}
          <div style={{
            position: "relative",
            background: "#0B0F1C",
            border: "1px solid #1B2440",
            borderRadius: 16,
            overflow: "hidden",
            minHeight: 380,
            backgroundImage: bgGlow,
          }}>
            {flash && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,59,110,0.25)", zIndex: 5 }} />
            )}

            <svg width="100%" height="100%" viewBox="0 0 700 400" style={{ position: "absolute", inset: 0 }}>
              <defs>
                <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="#1B2440" />
                </pattern>
                <linearGradient id="trailGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0" />
                  <stop offset="100%" stopColor={phase === "crashed" ? "#FF3B6E" : "#7C5CFF"} stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <rect width="700" height="400" fill="url(#dots)" />
              <g transform={`translate(${-camShift},0)`}>
                {pathD && (
                  <>
                    <path d={`${pathD} L ${planePos.x} 400 L 40 400 Z`} fill="url(#trailGrad)" opacity="0.18" />
                    <path d={pathD} fill="none" stroke={phase === "crashed" ? "#FF3B6E" : "#9D7CFF"} strokeWidth="3" strokeLinecap="round" />
                  </>
                )}
                {phase === "flying" && (
                  <g transform={`translate(${planePos.x},${planePos.y}) rotate(${planePos.angle})`}>
                    <circle r="16" fill="#7C5CFF" opacity="0.18" />
                    <g transform="rotate(90)">
                      <path d="M0,-10 L7,8 L0,4 L-7,8 Z" fill="#EDEFF7" />
                    </g>
                  </g>
                )}
              </g>
            </svg>

            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}>
              {phase === "betting" ? (
                <>
                  <div style={{ fontSize: 13, letterSpacing: 1, color: "#8891AA", fontWeight: 600, marginBottom: 6 }}>
                    NEXT ROUND IN
                  </div>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 54, fontWeight: 800, color: "#7C5CFF" }}>
                    {countdown}s
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: 68,
                    fontWeight: 800,
                    color: phase === "crashed" ? "#FF3B6E" : "#EDEFF7",
                    textShadow: phase === "crashed" ? "0 0 30px rgba(255,59,110,0.5)" : "0 0 30px rgba(124,92,255,0.35)",
                  }}>
                    {fmtMultiplier(multiplier)}
                  </div>
                  {phase === "crashed" && (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FF5C82", letterSpacing: 1, marginTop: 6 }}>
                      CRASHED
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ position: "absolute", bottom: 10, left: 14, display: "flex", alignItems: "center", gap: 6, color: "#4A5170", fontSize: 11 }}>
              <ShieldCheck size={13} />
              Provably fair • Real money
            </div>
          </div>

          {/* Stats */}
          {gameStats && (
            <div style={{ background: "#131A2C", border: "1px solid #232C48", borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8891AA", marginBottom: 12 }}>YOUR STATS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#5A6280" }}>Total Bets</span>
                  <span style={{ fontWeight: 600, color: "#EDEFF7" }}>{gameStats.total_bets}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#5A6280" }}>Wagered</span>
                  <span style={{ fontWeight: 600, color: "#EDEFF7" }}>KES {fmtMoney(gameStats.total_wagered)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#5A6280" }}>Won</span>
                  <span style={{ fontWeight: 600, color: "#4ADE9A" }}>KES {fmtMoney(gameStats.total_won)}</span>
                </div>
                <div style={{ height: "1px", background: "#232C48", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#5A6280" }}>P&L</span>
                  <span style={{ fontWeight: 600, color: gameStats.profit_loss >= 0 ? "#4ADE9A" : "#FF5C82" }}>
                    KES {fmtMoney(gameStats.profit_loss)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#5A6280" }}>Win Rate</span>
                  <span style={{ fontWeight: 600, color: "#7C5CFF" }}>{gameStats.win_rate}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bet panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {slots.map((slot, i) => (
            <BetPanel
              key={i}
              index={i}
              slot={slot}
              phase={phase}
              balance={balance}
              liveMultiplier={multiplier}
              onChangeAmount={(v) => changeAmount(i, v)}
              onPlace={placeBet}
              onCashOut={cashOut}
            />
          ))}
        </div>
      </div>

      {/* Deposit Modal */}
      {depositModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}>
          <div style={{
            background: "#131A2C",
            border: "1px solid #232C48",
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: "90%",
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Deposit via M-Pesa</h2>
            <input
              type="tel"
              placeholder="Phone: 254XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: 12,
                background: "#0E1424",
                border: "1px solid #232C48",
                borderRadius: 8,
                color: "#EDEFF7",
              }}
            />
            <input
              type="number"
              placeholder="Amount (KES)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: 16,
                background: "#0E1424",
                border: "1px solid #232C48",
                borderRadius: 8,
                color: "#EDEFF7",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setDepositModal(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#0E1424",
                  border: "1px solid #232C48",
                  borderRadius: 8,
                  color: "#B7BEDA",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={initiateDeposit}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#7C5CFF",
                  border: "none",
                  borderRadius: 8,
                  color: "#EDEFF7",
                  fontWeight: 600,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Processing..." : "Deposit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @media (max-width: 760px) {
          div[style*="grid-template-columns: minmax(0,1fr) 300px"] { grid-template-columns: 1fr !important; }
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
