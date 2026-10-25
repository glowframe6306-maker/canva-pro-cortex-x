/**
 * About Canva Modal Component
 * Displays comprehensive information about Canva platform
 */

interface AboutCanvaModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentRef?: any;
}

export function AboutCanvaModal({ isOpen, onClose, contentRef }: AboutCanvaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="w-full max-w-4xl max-h-[90vh] animate-in zoom-in duration-500">
        <div className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/98 to-slate-950/98 shadow-2xl backdrop-blur-2xl">
          {/* Close Button - X Icon */}
          <button
            type="button"
            aria-label="Close About Canva"
            onClick={onClose}
            className="absolute top-6 right-6 z-[100] flex h-10 w-10 cursor-pointer pointer-events-auto items-center justify-center rounded-full border border-cyan-400/30 bg-slate-900/80 text-cyan-300 hover:border-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition-all backdrop-blur-sm text-2xl font-bold"
          >
            ×
          </button>

          {/* Content */}
          <div
            ref={contentRef}
            className="about-modal-scroll relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
          >
            {/* Header */}
            <div className="relative overflow-hidden border-b border-cyan-400/20 px-6 py-12 text-center md:px-8 md:py-16">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10" />

              <div className="relative z-10">
                <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent mb-2">
                  About Canva
                </h1>
                <p className="text-lg md:text-xl font-bold text-cyan-300 mb-4">
                  Create. Design. Inspire.
                </p>
              </div>
            </div>

            <div className="space-y-8 px-6 py-12 md:space-y-10 md:px-8">
              {/* What is Canva */}
              <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                <h2 className="text-2xl font-black text-white mb-4">What is Canva?</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Canva is an online visual design and content creation platform that makes it easier for people to create professional-looking designs without needing advanced graphic-design skills.
                </p>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Users can use Canva to create a wide range of visual content including social-media graphics, presentations, posters, flyers, invitations, documents, videos, logos, educational materials, marketing content and many other designs.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Canva provides ready-made templates, design elements, fonts, images, illustrations, graphics, animations and other creative resources that can be combined using an easy visual editor.
                </p>
              </div>

              {/* What Can You Do With Canva */}
              <div>
                <h2 className="text-2xl font-black text-white mb-6">What Can You Do With Canva?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ["🎨", "Graphic Design", "Create posters, flyers, banners, cards, advertisements and other visual designs."],
                    ["📱", "Social Media", "Create posts, stories, thumbnails, covers and other social-media content."],
                    ["🎥", "Video Creation", "Create and edit videos using templates, animations, transitions, text and visual elements."],
                    ["📊", "Presentations", "Create professional presentations, educational slides and business presentations."],
                    ["📄", "Documents", "Create visually attractive documents, reports, worksheets and other content."],
                    ["🖼️", "Photo Editing", "Crop, resize, enhance and creatively edit images."],
                    ["✨", "AI-Powered Design", "Use AI-assisted creative tools to help generate ideas, text, images and other design elements."],
                    ["🎬", "Animations", "Add animations and motion effects to designs and presentations."],
                    ["📢", "Marketing", "Create advertisements, promotional graphics, brochures, business materials and campaign content."],
                    ["🎓", "Education", "Create worksheets, lesson materials, presentations, certificates, posters and educational resources."],
                    ["🏷️", "Branding", "Create brand-related materials such as logos, social-media graphics, presentations and marketing assets."],
                    ["📱", "Content Creation", "Create content for websites, social platforms, videos, blogs and digital marketing."],
                  ].map(([icon, title, desc], idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-6 backdrop-blur-sm hover:border-cyan-300/40 hover:bg-gradient-to-br hover:from-slate-800/60 hover:to-slate-900/60 transition-all"
                    >
                      <div className="text-3xl mb-3">{icon}</div>
                      <h3 className="font-bold text-white mb-2 text-lg">{title}</h3>
                      <p className="text-sm text-slate-300">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why People Use Canva */}
              <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 backdrop-blur-sm">
                <h2 className="text-2xl font-black text-white mb-6">Why People Use Canva</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "Easy drag-and-drop editor",
                    "Large collection of templates",
                    "Professional design resources",
                    "Beginner-friendly interface",
                    "Useful collaboration features",
                    "Supports images, videos and presentations",
                    "Available across multiple devices",
                    "Useful for students, creators, businesses and organizations",
                    "Helps users create designs quickly",
                    "Wide range of creative tools",
                  ].map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="text-cyan-400 font-bold text-lg flex-shrink-0 mt-1">✓</span>
                      <p className="text-slate-300">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Who Is Canva For */}
              <div>
                <h2 className="text-2xl font-black text-white mb-6">Who Is Canva For?</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ["👨‍🎓", "Students", "Presentations, assignments, posters, study materials and projects."],
                    ["🎨", "Designers & Creators", "Social-media content, graphics, videos and creative projects."],
                    ["🏢", "Businesses", "Marketing materials, presentations, advertisements and branded content."],
                    ["📱", "Content Creators", "Thumbnails, posts, stories, videos and digital content."],
                    ["👩‍🏫", "Teachers", "Worksheets, presentations, educational posters and classroom materials."],
                    ["🌐", "Organizations", "Announcements, promotional materials, reports and visual communications."],
                  ].map(([icon, title, desc], idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-6 backdrop-blur-sm hover:border-cyan-300/40 hover:bg-gradient-to-br hover:from-slate-800/60 hover:to-slate-900/60 transition-all"
                    >
                      <div className="text-3xl mb-3">{icon}</div>
                      <h3 className="font-bold text-white mb-2 text-lg">{title}</h3>
                      <p className="text-sm text-slate-300">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Grid */}
              <div>
                <h2 className="text-2xl font-black text-white mb-6">Popular Features & Use Cases</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[
                    ["🎨", "Design"],
                    ["🎤", "Presentations"],
                    ["🎥", "Videos"],
                    ["📱", "Social Media"],
                    ["🖼️", "Posters"],
                    ["📄", "Flyers"],
                    ["🎯", "Logos"],
                    ["▶️", "Thumbnails"],
                    ["📋", "Documents"],
                    ["🎓", "Education"],
                    ["📊", "Marketing"],
                    ["🏷️", "Branding"],
                    ["🖌️", "Photo Editing"],
                    ["✨", "Animations"],
                    ["🤖", "AI Tools"],
                    ["🌐", "Content Creation"],
                  ].map(([icon, label], idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-cyan-400/20 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-4 text-center hover:border-cyan-300/40 hover:bg-gradient-to-br hover:from-slate-800/60 hover:to-slate-900/60 transition-all backdrop-blur-sm"
                    >
                      <div className="text-2xl mb-2">{icon}</div>
                      <p className="text-xs md:text-sm font-semibold text-slate-300">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 md:p-8 backdrop-blur-sm">
                <h3 className="text-lg font-black text-amber-300 mb-4">⚠️ Disclaimer</h3>
                <p className="text-amber-100 text-sm leading-relaxed mb-3">
                  Canva is a third-party design platform. MI CORTEX X INC. is not affiliated with, endorsed by, or officially connected to Canva unless explicitly stated otherwise.
                </p>
                <p className="text-amber-100 text-sm leading-relaxed">
                  Do not claim that MI CORTEX X INC. is Canva. Do not use wording such as "Official Canva Partner", "Official Canva Seller", or "Canva Authorized Distributor" unless such authorization is explicitly provided.
                </p>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="border-t border-cyan-400/20 bg-gradient-to-b from-slate-900/50 to-slate-950/50 px-6 py-4 md:px-8 md:py-5 backdrop-blur-sm">
            <button
              type="button"
              onClick={onClose}
              className="w-full cursor-pointer rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.01] active:scale-[0.98]"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
