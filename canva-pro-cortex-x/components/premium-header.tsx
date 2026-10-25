/**
 * Premium Header Component with Logo and Branding
 * Displays circular logo, MI CORTEX X branding, and animations
 */

export function PremiumHeader() {
  return (
    <>
      <style>{`
        @keyframes headerLogoAppear {
          from {
            opacity: 0;
            transform: scale(0.85) translateY(-20px);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }

        @keyframes brandNameAppear {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }

        @keyframes logoHoverFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        .header-container {
          position: relative;
          width: 100%;
          padding: 2rem 1rem;
          text-align: center;
          background: linear-gradient(135deg, rgba(30, 30, 50, 0.5) 0%, rgba(50, 30, 80, 0.3) 50%, rgba(30, 50, 80, 0.5) 100%);
          overflow: hidden;
        }

        .header-glow-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          pointer-events: none;
        }

        .header-glow-element {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
        }

        .glow-purple {
          width: 300px;
          height: 300px;
          background: #8B5CF6;
          top: 0;
          left: 10%;
        }

        .glow-blue {
          width: 250px;
          height: 250px;
          background: #3B82F6;
          top: 100px;
          right: 15%;
        }

        .glow-cyan {
          width: 280px;
          height: 280px;
          background: #06B6D4;
          bottom: 20px;
          left: 20%;
        }

        .glow-pink {
          width: 240px;
          height: 240px;
          background: #EC4899;
          bottom: 50px;
          right: 10%;
        }

        .header-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .logo-wrapper {
          animation: headerLogoAppear 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          display: inline-flex;
          align-items: center;
          gap: 1rem;
          position: relative;
        }

        .logo-wrapper:hover {
          animation: logoHoverFloat 3s ease-in-out infinite;
        }

        .circular-logo {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow:
            0 0 40px rgba(139, 92, 246, 0.5),
            0 0 80px rgba(59, 130, 246, 0.3),
            0 8px 32px rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(255, 255, 255, 0.2);
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.1), transparent);
          transition: all 0.3s ease;
          position: relative;
        }

        .circular-logo::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            #8B5CF6,
            #06B6D4,
            #3B82F6,
            #EC4899,
            #8B5CF6
          );
          opacity: 0.3;
          filter: blur(2px);
          z-index: -1;
        }

        .logo-wrapper:hover .circular-logo {
          transform: scale(1.05);
          box-shadow:
            0 0 50px rgba(139, 92, 246, 0.7),
            0 0 100px rgba(59, 130, 246, 0.4),
            0 12px 48px rgba(0, 0, 0, 0.5);
        }

        .brand-name-section {
          animation: brandNameAppear 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          animation-delay: 0.3s;
          opacity: 0;
        }

        .brand-title {
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 900;
          letter-spacing: 0.08em;
          margin: 0;
          background: linear-gradient(135deg, #E0E7FF 0%, #F0F4FF 50%, #D0D8FF 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 30px rgba(139, 92, 246, 0.2);
          filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.15));
        }

        .canva-pro-text {
          font-size: clamp(1.25rem, 3vw, 2rem);
          font-weight: 700;
          letter-spacing: 0.06em;
          margin: 0;
          background: linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 15px rgba(6, 182, 212, 0.25));
        }

        .tagline-text {
          font-size: clamp(0.875rem, 2vw, 1.125rem);
          color: rgba(255, 255, 255, 0.7);
          margin-top: 0.5rem;
          letter-spacing: 0.05em;
          font-weight: 300;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .header-container {
            padding: 1.5rem 1rem;
          }

          .circular-logo {
            width: 100px;
            height: 100px;
          }

          .header-glow-bg {
            width: 400px;
            height: 400px;
          }

          .glow-purple,
          .glow-blue,
          .glow-cyan,
          .glow-pink {
            opacity: 0.2;
          }
        }

        @media (max-width: 480px) {
          .header-container {
            padding: 1rem;
          }

          .circular-logo {
            width: 80px;
            height: 80px;
          }

          .header-glow-bg {
            width: 300px;
            height: 300px;
          }

          .glow-element {
            filter: blur(60px);
          }
        }
      `}</style>

      <div className="header-container">
        <div className="header-glow-bg">
          <div className="header-glow-element glow-purple"></div>
          <div className="header-glow-element glow-blue"></div>
          <div className="header-glow-element glow-cyan"></div>
          <div className="header-glow-element glow-pink"></div>
        </div>

        <div className="header-content">
          <div className="logo-wrapper">
            <img
              src="/canva-logo.jpg"
              alt="Canva Logo"
              className="circular-logo"
            />
            <img
              src="/Cortex.png"
              alt="MI CORTEX X Logo"
              className="circular-logo"
            />
          </div>

          <div className="brand-name-section">
            <h1 className="brand-title">MI CORTEX X</h1>
            <h2 className="canva-pro-text">CANVA PRO</h2>
            <p className="tagline-text">Premium design tools. More creativity.</p>
          </div>
        </div>
      </div>
    </>
  );
}
