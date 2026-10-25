/**
 * Limited-Time Offer Banner Component
 * Displays promotional banner with countdown timer
 */

"use client";

import { useEffect, useState } from "react";

interface PromotionBannerProps {
  onScrollToPlans?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

interface Promotion {
  id: string;
  enabled: boolean;
  title: string;
  description: string;
  offerText: string;
  buttonText: string;
  buttonAction: string;
  expiryDate?: string;
  expiryTime?: string;
}

export function LimitedTimeOfferBanner({ onScrollToPlans }: PromotionBannerProps) {
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch active promotion
  useEffect(() => {
    const fetchPromotion = async () => {
      try {
        const response = await fetch("/api/promotions/active");
        const data = await response.json();
        if (data.promotion) {
          setPromotion(data.promotion);
        }
      } catch (error) {
        console.error("Failed to fetch promotion:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPromotion();
  }, []);

  // Calculate time remaining
  useEffect(() => {
    if (!promotion?.expiryDate || !promotion?.expiryTime) {
      setTimeRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const expiryDateTime = new Date(`${promotion.expiryDate}T${promotion.expiryTime}`);
      const now = new Date();
      const difference = expiryDateTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeRemaining({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({
        days,
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [promotion]);

  // Don't show if no promotion or expired
  if (isLoading || !promotion || timeRemaining?.isExpired) {
    return null;
  }

  const handleCTAClick = () => {
    if (promotion.buttonAction === "scroll-to-plans" && onScrollToPlans) {
      onScrollToPlans();
    }
  };

  const padZero = (num: number) => String(num).padStart(2, "0");

  return (
    <>
      <style>{`
      @keyframes bannerSlideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes bannerGlow {
        0%, 100% {
          box-shadow:
            0 0 20px rgba(239, 68, 68, 0.3),
            inset 0 0 30px rgba(239, 68, 68, 0.1);
        }
        50% {
          box-shadow:
            0 0 40px rgba(239, 68, 68, 0.5),
            inset 0 0 30px rgba(239, 68, 68, 0.15);
        }
      }

      @keyframes buttonPulse {
        0%, 100% {
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
        }
        50% {
          box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
        }
      }

      .banner-container {
        animation: bannerSlideDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        background: linear-gradient(135deg, rgba(30, 20, 50, 0.95) 0%, rgba(50, 30, 60, 0.92) 50%, rgba(30, 40, 60, 0.95) 100%);
        border: 1px solid;
        border-image: linear-gradient(135deg, rgba(239, 68, 68, 0.6) 0%, rgba(34, 197, 94, 0.4) 100%) 1;
        position: relative;
        overflow: hidden;
      }

      .banner-container::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 20% 50%, rgba(239, 68, 68, 0.15) 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%);
        pointer-events: none;
      }

      .banner-glow {
        animation: bannerGlow 3s ease-in-out infinite;
      }

      .banner-content {
        position: relative;
        z-index: 10;
      }

      .countdown-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .countdown-number {
        font-size: 1.75rem;
        font-weight: 900;
        color: #22c55e;
        font-family: 'Monaco', 'Courier New', monospace;
        text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
      }

      .countdown-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(34, 197, 94, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .cta-button {
        animation: buttonPulse 2s infinite;
        transition: all 0.3s ease;
      }

      .cta-button:hover {
        animation: none;
        transform: scale(1.05);
        box-shadow: 0 0 30px rgba(34, 197, 94, 0.8) !important;
      }

      .cta-button:active {
        transform: scale(0.98);
      }

      @media (max-width: 768px) {
        .countdown-number {
          font-size: 1.25rem;
        }

        .countdown-label {
          font-size: 0.65rem;
        }
      }
    `}</style>

      <div className="banner-container banner-glow w-full px-4 py-6 md:py-8 lg:py-10 backdrop-blur-xl">
      <div className="banner-content mx-auto max-w-6xl">
        {/* Main Banner Content */}
        <div className="space-y-4 md:space-y-6">
          {/* Title and Offer Text */}
          <div className="text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="text-2xl md:text-3xl">🔥</span>
              <h2 className="text-xl md:text-3xl font-black bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                {promotion.title}
              </h2>
              <span className="text-2xl md:text-3xl">🔥</span>
            </div>

            {promotion.description && (
              <p className="text-sm md:text-base text-slate-300 mt-2">
                {promotion.description}
              </p>
            )}

            {promotion.offerText && (
              <p className="text-xs md:text-sm font-bold text-cyan-300 mt-2 uppercase tracking-wider">
                ✨ {promotion.offerText}
              </p>
            )}
          </div>

          {/* Countdown Timer or Button */}
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-8 lg:gap-12">
            {/* Countdown */}
            {timeRemaining && !timeRemaining.isExpired && (
              <div className="flex gap-3 md:gap-4 lg:gap-6">
                <div className="countdown-item">
                  <div className="countdown-number">{padZero(timeRemaining.days)}</div>
                  <div className="countdown-label">Days</div>
                </div>
                <div className="flex items-center text-xl md:text-2xl font-bold text-green-400">:</div>
                <div className="countdown-item">
                  <div className="countdown-number">{padZero(timeRemaining.hours)}</div>
                  <div className="countdown-label">Hours</div>
                </div>
                <div className="flex items-center text-xl md:text-2xl font-bold text-green-400">:</div>
                <div className="countdown-item">
                  <div className="countdown-number">{padZero(timeRemaining.minutes)}</div>
                  <div className="countdown-label">Min</div>
                </div>
                <div className="flex items-center text-xl md:text-2xl font-bold text-green-400">:</div>
                <div className="countdown-item">
                  <div className="countdown-number">{padZero(timeRemaining.seconds)}</div>
                  <div className="countdown-label">Sec</div>
                </div>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleCTAClick}
              className="cta-button group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-6 md:px-8 py-3 md:py-4 font-bold text-white shadow-lg transition-all duration-300 hover:shadow-2xl md:whitespace-nowrap"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-green-400/20 via-transparent to-teal-400/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative flex items-center gap-2">
                <span className="text-lg">→</span>
                <span className="text-sm md:text-base">{promotion.buttonText}</span>
              </span>
            </button>
          </div>

          {/* Footer Text */}
          {!timeRemaining && (
            <div className="text-center text-xs md:text-sm text-slate-400">
              Special offer available now
            </div>
          )}
          {timeRemaining && !timeRemaining.isExpired && (
            <div className="text-center text-xs md:text-sm font-semibold text-yellow-300">
              ⏰ Ends Soon - Don't Miss Out!
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
