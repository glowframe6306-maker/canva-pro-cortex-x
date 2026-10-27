"use client";

import { useEffect, useState } from "react";

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  urgencyLevel: "normal" | "soon" | "urgent" | "very-urgent";
  urgencyLabel: string;
}

interface PromotionCountdownProps {
  endDate?: string;
  endTime?: string;
  onExpired?: () => void;
  compact?: boolean;
}

function calculateCountdown(endDate?: string, endTime?: string): CountdownTime {
  if (!endDate || !endTime) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
      urgencyLevel: "normal",
      urgencyLabel: "",
    };
  }

  try {
    const expiryText = `${endDate}T${endTime}`;
    const expiryTime = new Date(expiryText);
    const now = new Date();
    const diff = expiryTime.getTime() - now.getTime();

    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        isExpired: true,
        urgencyLevel: "very-urgent",
        urgencyLabel: "EXPIRED",
      };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let urgencyLevel: "normal" | "soon" | "urgent" | "very-urgent" = "normal";
    let urgencyLabel = "OFFER ENDS IN";

    if (totalSeconds < 600) {
      urgencyLevel = "very-urgent";
      urgencyLabel = "⚡ ENDS VERY SOON";
    } else if (totalSeconds < 3600) {
      urgencyLevel = "urgent";
      urgencyLabel = "🔥 ALMOST OVER";
    } else if (totalSeconds < 86400) {
      urgencyLevel = "soon";
      urgencyLabel = "🔥 ENDING SOON";
    }

    return {
      days,
      hours,
      minutes,
      seconds,
      totalSeconds,
      isExpired: false,
      urgencyLevel,
      urgencyLabel,
    };
  } catch {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
      urgencyLevel: "normal",
      urgencyLabel: "EXPIRED",
    };
  }
}

export function PromotionCountdown({ endDate, endTime, onExpired, compact = false }: PromotionCountdownProps) {
  const [countdown, setCountdown] = useState<CountdownTime>(() => calculateCountdown(endDate, endTime));
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCountdown(calculateCountdown(endDate, endTime));
  }, [endDate, endTime]);

  useEffect(() => {
    if (!isClient || !endDate || !endTime || countdown.isExpired) return;

    const interval = setInterval(() => {
      const newCountdown = calculateCountdown(endDate, endTime);
      setCountdown(newCountdown);

      if (newCountdown.isExpired && onExpired) {
        onExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isClient, endDate, endTime, countdown.isExpired, onExpired]);

  if (!isClient || countdown.isExpired || !endDate || !endTime) {
    return null;
  }

  const formatNumber = (num: number) => String(num).padStart(2, "0");

  if (compact) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-3 py-2 border border-amber-400/30">
        <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
          {countdown.urgencyLabel}
        </span>
        <span className="text-sm font-bold text-amber-200">
          {formatNumber(countdown.hours)}:{formatNumber(countdown.minutes)}:{formatNumber(countdown.seconds)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`mt-4 rounded-2xl border backdrop-blur-sm p-4 transition-all ${
        countdown.urgencyLevel === "very-urgent"
          ? "border-red-400/50 bg-gradient-to-r from-red-500/15 to-orange-500/15 shadow-lg shadow-red-500/20"
          : countdown.urgencyLevel === "urgent"
            ? "border-amber-400/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 shadow-lg shadow-amber-500/20"
            : countdown.urgencyLevel === "soon"
              ? "border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-yellow-500/10"
              : "border-purple-400/20 bg-gradient-to-r from-purple-500/10 to-pink-500/10"
      }`}
    >
      <div className="mb-3 text-center">
        <p
          className={`text-sm font-bold uppercase tracking-widest ${
            countdown.urgencyLevel === "very-urgent"
              ? "text-red-300"
              : countdown.urgencyLevel === "urgent"
                ? "text-amber-300"
                : countdown.urgencyLevel === "soon"
                  ? "text-amber-300"
                  : "text-purple-300"
          }`}
        >
          {countdown.urgencyLabel}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "DAYS", value: countdown.days },
          { label: "HRS", value: countdown.hours },
          { label: "MIN", value: countdown.minutes },
          { label: "SEC", value: countdown.seconds },
        ].map(({ label, value }, idx) => (
          <div
            key={idx}
            className={`flex flex-col items-center justify-center rounded-lg border-2 bg-gradient-to-br p-3 text-center transition-all ${
              countdown.urgencyLevel === "very-urgent"
                ? "border-red-400/60 from-slate-900/80 to-red-900/40 shadow-lg shadow-red-500/30"
                : countdown.urgencyLevel === "urgent"
                  ? "border-amber-400/50 from-slate-900/80 to-amber-900/30 shadow-lg shadow-amber-500/20"
                  : countdown.urgencyLevel === "soon"
                    ? "border-amber-400/40 from-slate-900/70 to-amber-900/20 shadow-md shadow-amber-500/15"
                    : "border-purple-400/30 from-slate-900/60 to-purple-900/20 shadow-md shadow-purple-500/10"
            }`}
          >
            <div className="text-lg font-black text-white">{formatNumber(value)}</div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-300">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { calculateCountdown };
export type { CountdownTime };
