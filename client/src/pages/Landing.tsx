import { useEffect } from 'react';
import { Link } from 'wouter';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

function AnimatedHeading({ text, color }: { text: string; color?: string }) {
  const words = text.split(' ');
  let letterIndex = 0;
  return (
    <span aria-label={text}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {word.split('').map((char) => {
            const delay = letterIndex++ * 0.05;
            return (
              <span
                key={char + delay}
                style={{
                  display: 'inline-block',
                  opacity: 0,
                  transform: 'translateY(20px)',
                  animation: `letterReveal 0.6s ease forwards`,
                  animationDelay: `${delay}s`,
                  color: color,
                }}
              >
                {char}
              </span>
            );
          })}
          {wi < words.length - 1 && (
            <span style={{ display: 'inline-block' }}>&nbsp;</span>
          )}
        </span>
      ))}
    </span>
  );
}


export default function Landing() {

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
        } else {
          e.target.classList.remove('visible');
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.fade-in').forEach(el =>
      observer.observe(el)
    );
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '16px 48px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#4338ca' }}>
          BUILD<span style={{ color: '#1a1a2e' }}>ESTIMATE</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login">
            <button style={{
              padding: '8px 20px', borderRadius: 8,
              border: '1.5px solid #e0e0e0', background: 'transparent',
              fontSize: 14, fontWeight: 500, color: '#444', cursor: 'pointer'
            }}>Sign In</button>
          </Link>
          <Link href="/signup">
            <button style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#4338ca', fontSize: 14, fontWeight: 600,
              color: '#fff', cursor: 'pointer'
            }}>Get Started</button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        padding: '120px 48px 80px',
        background: 'linear-gradient(160deg,#f5f3ff 0%,#ede9fe 40%,#e0f2fe 100%)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', width: '100%',
          display: 'grid', gridTemplateColumns: '1fr 1.2fr',
          gap: 64, alignItems: 'center'
        }}>

          {/* LEFT — Text content */}
          <div style={{ textAlign: 'left' }}>
            <div style={{
              display: 'inline-block', padding: '6px 16px',
              borderRadius: 999, background: '#ede9fe', color: '#4338ca',
              fontSize: 13, fontWeight: 600, marginBottom: 24,
              border: '1px solid #c4b5fd'
            }}>BOQ Management System</div>

            <h1 style={{
              fontSize: 52, fontWeight: 800, lineHeight: 1.15,
              color: '#1a1a2e', marginBottom: 20, letterSpacing: -1.5
            }}>
              <AnimatedHeading text="From Blueprint to Budget — " />
              <AnimatedHeading text="In Minutes" color="#4338ca" />
            </h1>

            <p style={{
              fontSize: 17, color: '#64748b',
              marginBottom: 40, lineHeight: 1.7
            }}>
              The complete platform for construction & interior fit-out
              teams to manage Bill of Quantities, materials, vendors
              and procurement — all in one place.
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link href="/login">
                <button style={{
                  padding: '14px 32px', borderRadius: 12, border: 'none',
                  background: '#4338ca', fontSize: 16, fontWeight: 600,
                  color: '#fff', cursor: 'pointer'
                }}>Access BUILDESTIMATE →</button>
              </Link>
              <a href="#features">
                <button style={{
                  padding: '14px 32px', borderRadius: 12,
                  border: '2px solid #c4b5fd', background: '#fff',
                  fontSize: 16, fontWeight: 600, color: '#4338ca',
                  cursor: 'pointer'
                }}>See Features</button>
              </a>
            </div>

            <div style={{
              display: 'flex', gap: 40, marginTop: 48, flexWrap: 'wrap'
            }}>
              {[
                { num: '10+', label: 'User Roles' },
                { num: 'BOQ', label: 'Automated' },
                { num: '100%', label: 'Web Based' },
                { num: 'Live', label: 'Tracking' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 26, fontWeight: 800,
                    color: '#4338ca'
                  }}>{s.num}</div>
                  <div style={{
                    fontSize: 13, color: '#94a3b8',
                    marginTop: 2
                  }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Lottie animation */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'center'
          }}>
            <DotLottieReact
              src="/hero-animation.lottie"
              autoplay
              loop
              style={{ width: '100%', maxWidth: 600 }}
            />
          </div>

        </div>
      </section>

      {/* WHAT IS BOQ */}
      <section className="fade-in" style={{
        background: '#fafafa', padding: '96px 48px'
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 64, alignItems: 'center'
        }}>
          <div>
            <div style={{
              display: 'inline-block', padding: '4px 14px',
              borderRadius: 999, background: '#ede9fe', color: '#4338ca',
              fontSize: 12, fontWeight: 600, marginBottom: 16,
              textTransform: 'uppercase', letterSpacing: 0.5
            }}>What is a BOQ?</div>
            <h2 style={{
              fontSize: 38, fontWeight: 800, color: '#1a1a2e',
              letterSpacing: -1, marginBottom: 16
            }}>
              <AnimatedHeading text="Never miss a material or overbill a client again" />
            </h2>
            <p style={{
              fontSize: 16, color: '#64748b',
              lineHeight: 1.8, marginBottom: 16
            }}>
              A Bill of Quantities (BOQ) is a detailed document used
              in construction that lists every material, labour and
              cost item for a project.
            </p>
            <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.8 }}>
              Without a proper BOQ, projects run over budget, materials
              get missed and clients lose trust. BUILDESTIMATE makes
              it simple.
            </p>
          </div>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 32,
            border: '1px solid #e8e8e8'
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#94a3b8',
              marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5
            }}>Sample BOQ — Interior Project</div>
            {[
              { label: 'Gypsum Ceiling', rate: '₹85/sqft', qty: '240 sqft', color: '#4338ca' },
              { label: 'Electrical Wiring', rate: '₹45/rft', qty: '180 rft', color: '#6366f1' },
              { label: 'Marble Flooring', rate: '₹120/sqft', qty: '320 sqft', color: '#8b5cf6' },
              { label: 'Paint — Asian Paints', rate: '₹28/sqft', qty: '400 sqft', color: '#a78bfa' },
            ].map(r => (
              <div key={r.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid #f5f5f5'
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: r.color, flexShrink: 0
                }} />
                <div style={{ flex: 1, fontSize: 14, color: '#374151' }}>
                  {r.label}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: '#1a1a2e'
                }}>{r.rate}</div>
                <div style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 999,
                  background: '#ede9fe', color: '#4338ca', fontWeight: 600
                }}>{r.qty}</div>
              </div>
            ))}
            <div style={{
              marginTop: 20, paddingTop: 16,
              borderTop: '2px solid #f0f0f0',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: 14, color: '#64748b' }}>
                Total Estimate
              </span>
              <span style={{
                fontSize: 20, fontWeight: 800,
                color: '#4338ca'
              }}>₹92,400</span>
            </div>
          </div>
        </div>
      </section>

      {/* ROLES */}
      <section className="fade-in" style={{
        background: '#fff5f2',
        padding: '96px 48px'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Section header */}
          <div style={{
            display: 'inline-block', padding: '4px 14px',
            borderRadius: 999, background: '#ffe4ef', color: '#e11d48',
            fontSize: 12, fontWeight: 600, marginBottom: 16,
            textTransform: 'uppercase', letterSpacing: 0.5
          }}>Who is it for?</div>
          <h2 style={{
            fontSize: 38, fontWeight: 800, color: '#1a1a2e',
            letterSpacing: -1, marginBottom: 12
          }}>
            <AnimatedHeading text="Built for every team member" />
          </h2>
          <p style={{
            fontSize: 17, color: '#64748b', maxWidth: 520,
            lineHeight: 1.7, marginBottom: 48
          }}>
            From designers to site engineers — every role has
            its own dashboard and tools.
          </p>

          {/* Two column */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center'
          }}>

            {/* LEFT — Paper plane SVG animation */}
            <div style={{ position: 'relative', height: 520 }}>
              <svg
                viewBox="0 0 380 520"
                style={{ width: '100%', height: '100%', overflow: 'visible' }}
              >
                {/* ROUNDED STAIRCASE PATH using curves */}
                <path
                  id="planePath"
                  d="M 60 60 
                     L 240 60 
                     Q 270 60 270 90
                     L 270 150
                     Q 270 180 240 180
                     L 100 180
                     Q 70 180 70 210
                     L 70 290
                     Q 70 320 100 320
                     L 260 320
                     Q 290 320 290 350
                     L 290 420
                     Q 290 450 260 450
                     L 160 450
                     L 160 500"
                  fill="none"
                  stroke="#1a1a2e"
                  strokeWidth="2.5"
                  strokeDasharray="10 7"
                  strokeLinecap="round"
                />

                {/* STEP 01 — dot + hanging tag */}
                <circle cx="60" cy="60" r="5" fill="#1a1a2e" />
                <line x1="60" y1="67" x2="60" y2="90"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <rect x="10" y="90" width="120" height="32"
                  rx="4" fill="white"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <text x="70" y="111" textAnchor="middle"
                  style={{
                    fontSize: 12, fontWeight: 700,
                    fill: '#1a1a2e',
                    fontFamily: 'Plus Jakarta Sans, sans-serif'
                  }}>
                  Create Project
                </text>

                {/* STEP 02 — dot + hanging tag */}
                <circle cx="270" cy="180" r="5" fill="#1a1a2e" />
                <line x1="270" y1="187" x2="270" y2="210"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <rect x="200" y="210" width="130" height="32"
                  rx="4" fill="white"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <text x="265" y="231" textAnchor="middle"
                  style={{
                    fontSize: 12, fontWeight: 700,
                    fill: '#1a1a2e',
                    fontFamily: 'Plus Jakarta Sans, sans-serif'
                  }}>
                  Build Your BOQ
                </text>

                {/* STEP 03 — dot + hanging tag */}
                <circle cx="70" cy="320" r="5" fill="#1a1a2e" />
                <line x1="70" y1="327" x2="70" y2="350"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <rect x="10" y="350" width="120" height="32"
                  rx="4" fill="white"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <text x="70" y="371" textAnchor="middle"
                  style={{
                    fontSize: 12, fontWeight: 700,
                    fill: '#1a1a2e',
                    fontFamily: 'Plus Jakarta Sans, sans-serif'
                  }}>
                  Get Approvals
                </text>

                {/* STEP 04 — dot + hanging tag */}
                <circle cx="290" cy="420" r="5" fill="#1a1a2e" />
                <line x1="290" y1="427" x2="290" y2="450"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <rect x="220" y="450" width="130" height="32"
                  rx="4" fill="white"
                  stroke="#1a1a2e" strokeWidth="1.5" />
                <text x="285" y="471" textAnchor="middle"
                  style={{
                    fontSize: 12, fontWeight: 700,
                    fill: '#1a1a2e',
                    fontFamily: 'Plus Jakarta Sans, sans-serif'
                  }}>
                  Procure & Track
                </text>

                {/* PAPER PLANE */}
                <g id="paperPlane" transform="scale(1.4)">
                  {/* Outer body — white fill with dark border */}
                  <polygon
                    points="18,0 -8,-10 -4,0"
                    fill="white"
                    stroke="#1a1a2e"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <polygon
                    points="18,0 -8,10 -4,0"
                    fill="white"
                    stroke="#1a1a2e"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  {/* Back fold triangle */}
                  <polygon
                    points="-8,-10 -8,10 -4,0"
                    fill="#f0f0f0"
                    stroke="#1a1a2e"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  {/* Center crease */}
                  <line
                    x1="18" y1="0" x2="-4" y2="0"
                    stroke="#1a1a2e"
                    strokeWidth="0.8"
                    opacity="0.5"
                  />
                  {/* Inner fold line top */}
                  <line
                    x1="-4" y1="0" x2="-2" y2="-6"
                    stroke="#1a1a2e"
                    strokeWidth="0.7"
                    opacity="0.4"
                  />
                </g>

                <animateMotion
                  xlinkHref="#paperPlane"
                  dur="14s"
                  repeatCount="indefinite"
                  rotate="auto"
                >
                  <mpath xlinkHref="#planePath" />
                </animateMotion>

              </svg>
            </div>


            {/* RIGHT — Role cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16
            }}>
              {[
                {
                  icon: '🎨', title: 'Interior Designer / Client',
                  desc: 'Create projects and generate BOQs from sketch plans.',
                  bg: '#fff0f6', border: '#ffd6e7', iconBg: '#ffe4ef'
                },
                {
                  icon: '🏗️', title: 'Contractor',
                  desc: 'Manage execution and track delivery against BOQs.',
                  bg: '#fff7e6', border: '#ffe4b5', iconBg: '#fff0cc'
                },
                {
                  icon: '👷', title: 'Site Engineer',
                  desc: 'Submit daily logs and post real-time site reports.',
                  bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#dcfce7'
                },
                {
                  icon: '🛒', title: 'Purchase Team',
                  desc: 'Generate POs and coordinate material approvals.',
                  bg: '#eff6ff', border: '#bfdbfe', iconBg: '#dbeafe'
                },
                {
                  icon: '💰', title: 'Finance Team',
                  desc: 'Finalize BOQs and manage project budgets.',
                  bg: '#f5f3ff', border: '#ddd6fe', iconBg: '#ede9fe'
                },
                {
                  icon: '🏪', title: 'Vendor / Supplier',
                  desc: 'Upload rate cards and submit price proposals.',
                  bg: '#fef9c3', border: '#fde68a', iconBg: '#fef08a'
                },
              ].map((r, index) => (
                <div key={r.title} className="card-animate" style={{
                  background: r.bg,
                  border: `1px solid ${r.border}`,
                  borderRadius: 16,
                  padding: 20,
                  transition: 'all 0.25s',
                  opacity: 0,
                  transform: 'translateY(40px)',
                  animationDelay: `${index * 0.15}s`
                }}>
                  <div style={{
                    fontSize: 24, width: 40, height: 40, borderRadius: 10,
                    background: r.iconBg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 12
                  }}>{r.icon}</div>
                  <h3 style={{
                    fontSize: 14, fontWeight: 700,
                    color: '#1a1a2e', marginBottom: 6
                  }}>{r.title}</h3>
                  <p style={{
                    fontSize: 13, color: '#64748b',
                    lineHeight: 1.5
                  }}>{r.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="fade-in" id="features" style={{
        background: '#f8fafc', padding: '96px 48px'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Section header */}
          <div style={{
            display: 'inline-block', padding: '4px 14px',
            borderRadius: 999, background: '#ede9fe', color: '#4338ca',
            fontSize: 12, fontWeight: 600, marginBottom: 16,
            textTransform: 'uppercase', letterSpacing: 0.5
          }}>Core Features</div>
          <h2 style={{
            fontSize: 38, fontWeight: 800, color: '#1a1a2e',
            letterSpacing: -1, marginBottom: 12
          }}>
            <AnimatedHeading text="Everything you need" />
          </h2>
          <p style={{
            fontSize: 17, color: '#64748b', maxWidth: 520,
            lineHeight: 1.7, marginBottom: 48
          }}>
            Powerful tools built specifically for construction
            and interior fit-out workflows.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20
          }}>
            {[
              {
                icon: '📐', title: 'Sketch to BOQ',
                desc: 'Draw your floor plan and let BUILDESTIMATE automatically generate the matching Bill of Quantities.'
              },
              {
                icon: '📦', title: 'Material Registry',
                desc: 'Centralized catalog of all materials with rates, brands, specs and HSN codes from verified vendors.'
              },
              {
                icon: '📋', title: 'Procurement & PO',
                desc: 'Raise purchase requests, generate formal POs and track multi-level approvals from one dashboard.'
              },
              {
                icon: '🚚', title: 'Delivery Tracker',
                desc: 'Monitor material shipments, manage gate entry passes and confirm delivery status in real time.'
              },
              {
                icon: '📊', title: 'Excel Export',
                desc: 'Export your complete BOQ, material lists and shop data to Excel with one click.'
              },
              {
                icon: '🔒', title: 'Role-Based Access',
                desc: 'Every team member sees only what they need — no clutter, no confusion, no security risk.'
              },
            ].map((f, index) => (
              <div key={f.title} className="card-animate" style={{
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: 16,
                padding: 24,
                transition: 'all 0.25s',
                opacity: 0,
                transform: 'translateY(40px)',
                animationDelay: `${index * 0.15}s`
              }}>
                <div style={{
                  fontSize: 24, width: 48, height: 48, borderRadius: 14,
                  background: '#ede9fe', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16
                }}>{f.icon}</div>
                <h3 style={{
                  fontSize: 15, fontWeight: 700,
                  color: '#1a1a2e', marginBottom: 8
                }}>{f.title}</h3>
                <p style={{
                  fontSize: 13, color: '#64748b',
                  lineHeight: 1.6
                }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE SECTION ── */}
      <section className="fade-in" id="showcase" style={{
        background: '#fff5f2',
        padding: '96px 48px',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center'
          }}>

            {/* LEFT — Blueprint + pencil + text overlay */}
            <div style={{ position: 'relative', height: 420 }}>
              <svg viewBox="0 0 440 420"
                style={{ width: '100%', height: '100%' }}>

                {/* Grid lines */}
                {[0,1,2,3,4,5,6,7,8].map(i => (
                  <line key={'h'+i}
                    x1="0" y1={i*52} x2="440" y2={i*52}
                    stroke="#f8b4c8" strokeWidth="0.8"
                    strokeDasharray="4 4" opacity="0.5"/>
                ))}
                {[0,1,2,3,4,5,6,7,8,9].map(i => (
                  <line key={'v'+i}
                    x1={i*52} y1="0" x2={i*52} y2="420"
                    stroke="#f8b4c8" strokeWidth="0.8"
                    strokeDasharray="4 4" opacity="0.5"/>
                ))}

                {/* Floor plan */}
                <rect x="40" y="60" width="160" height="120"
                  fill="none" stroke="#e879a0"
                  strokeWidth="1.5" opacity="0.4"/>
                <rect x="40" y="180" width="80" height="80"
                  fill="none" stroke="#e879a0"
                  strokeWidth="1.5" opacity="0.4"/>
                <rect x="120" y="180" width="80" height="80"
                  fill="none" stroke="#e879a0"
                  strokeWidth="1.5" opacity="0.4"/>
                <rect x="220" y="60" width="120" height="80"
                  fill="none" stroke="#e879a0"
                  strokeWidth="1.5" opacity="0.3"/>
                <line x1="40" y1="120" x2="200" y2="120"
                  stroke="#e879a0" strokeWidth="1" opacity="0.3"/>
                <line x1="120" y1="60" x2="120" y2="180"
                  stroke="#e879a0" strokeWidth="1" opacity="0.3"/>

                {/* Dimension lines */}
                <line x1="40" y1="50" x2="200" y2="50"
                  stroke="#c084a0" strokeWidth="1" opacity="0.5"/>
                <text x="110" y="46" textAnchor="middle"
                  style={{ fontSize: 9, fill: '#c084a0',
                  fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  8.5 m
                </text>
                <line x1="30" y1="60" x2="30" y2="260"
                  stroke="#c084a0" strokeWidth="1" opacity="0.5"/>
                <text x="18" y="165" textAnchor="middle"
                  style={{ fontSize: 9, fill: '#c084a0',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '18px 165px' }}>
                  6m
                </text>

                {/* Room labels */}
                <text x="105" y="95" textAnchor="middle"
                  style={{ fontSize: 10, fill: '#d4607a',
                  opacity: 0.6,
                  fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Living Room
                </text>
                <text x="75" y="228" textAnchor="middle"
                  style={{ fontSize: 9, fill: '#d4607a',
                  opacity: 0.6,
                  fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Bedroom
                </text>
                <text x="160" y="228" textAnchor="middle"
                  style={{ fontSize: 9, fill: '#d4607a',
                  opacity: 0.6,
                  fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Kitchen
                </text>

                {/* Pencil */}
                <g transform="translate(280, 240) rotate(-35)">
                  <rect x="-8" y="-70" width="16" height="100"
                    rx="2" fill="#fbbf24"/>
                  <polygon points="-8,30 8,30 0,52"
                    fill="#f5e6cc"/>
                  <polygon points="-2,46 2,46 0,52"
                    fill="#374151"/>
                  <rect x="-8" y="-78" width="16" height="8"
                    rx="1" fill="#9ca3af"/>
                  <rect x="-8" y="-86" width="16" height="8"
                    rx="2" fill="#fca5a5"/>
                  <rect x="-8" y="-20" width="16" height="4"
                    fill="#f59e0b" opacity="0.6"/>
                </g>

                {/* Floating BOQ badge */}
                <rect x="300" y="60" width="120" height="36"
                  rx="8" fill="white"
                  stroke="#fda4af" strokeWidth="1.5"
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}/>
                <text x="360" y="74" textAnchor="middle"
                  style={{ fontSize: 10, fontWeight: 700,
                  fill: '#4338ca',
                  fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  BOQ Generated
                </text>
                <text x="360" y="88" textAnchor="middle"
                  style={{ fontSize: 9, fill: '#64748b',
                  fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  ✓ 24 line items
                </text>
              </svg>

              {/* Text overlay at bottom of left column */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0
              }}>
                <div style={{
                  display: 'inline-block', padding: '4px 14px',
                  borderRadius: 999, background: '#ffe4ef',
                  color: '#e11d48', fontSize: 12, fontWeight: 600,
                  marginBottom: 12, textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>See it in action</div>
                <h2 style={{
                  fontSize: 34, fontWeight: 800, color: '#1a1a2e',
                  letterSpacing: -1, lineHeight: 1.2, marginBottom: 12
                }}>
                  <AnimatedHeading text="Sketch a plan." /><br/>
                  <AnimatedHeading text="Get a BOQ instantly." />
                </h2>
                <p style={{
                  fontSize: 15, color: '#64748b', lineHeight: 1.7,
                  maxWidth: 380
                }}>
                  Draw your floor plan, mark the rooms —
                  BUILDESTIMATE generates every material,
                  quantity and rate automatically.
                </p>
              </div>
            </div>

            {/* RIGHT — MacBook with slideshow */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <style>{`
                @keyframes macOpen {
                  0%   { transform: perspective(1900px) rotateX(-88.5deg); }
                  100% { transform: perspective(1000px) rotateX(0deg); }
                }
                .mac-screen {
                  border-radius: 20px;
                  box-shadow: inset 0 0 0 2px #c8cacb, inset 0 0 0 10px #000;
                  height: 318px;
                  width: 518px;
                  margin: 0 auto;
                  position: relative;
                  overflow: hidden;
                  background: #1a1a1a;
                  transform-style: preserve-3d;
                  transform: perspective(1900px) rotateX(-88.5deg);
                  transform-origin: 50% 100%;
                }
                #showcase.visible .mac-screen {
                  animation: macOpen 3s ease forwards;
                }
                #showcase:not(.visible) .mac-screen {
                  animation: none;
                  transform: perspective(1900px) rotateX(-88.5deg);
                }
                .mac-screen::before {
                  content: "";
                  width: 518px;
                  height: 12px;
                  position: absolute;
                  background: linear-gradient(#979899, transparent);
                  top: -3px;
                  left: 0;
                  transform: rotateX(90deg);
                  border-radius: 5px 5px 0 0;
                  z-index: 40;
                }
                .mac-screen::after {
                  background: linear-gradient(to bottom, #272727, #0d0d0d);
                  border-radius: 0 0 20px 20px;
                  bottom: 0;
                  content: "";
                  height: 24px;
                  left: 0;
                  position: absolute;
                  width: 100%;
                  z-index: 40;
                }
                .mac-keyboard {
                  background: radial-gradient(circle at center, #e2e3e4 85%, #a9abac 100%);
                  border: solid #a0a3a7;
                  border-radius: 2px 2px 12px 12px;
                  border-width: 1px 2px 0 2px;
                  box-shadow: inset 0 -2px 8px 0 #6c7074;
                  height: 24px;
                  margin-top: -10px;
                  position: relative;
                  width: 620px;
                  z-index: 9;
                  margin-left: auto;
                  margin-right: auto;
                }
                .mac-keyboard::after {
                  background: #e2e3e4;
                  border-radius: 0 0 10px 10px;
                  box-shadow: inset 0 0 4px 2px #babdbf;
                  content: "";
                  height: 10px;
                  left: 50%;
                  margin-left: -60px;
                  position: absolute;
                  top: 0;
                  width: 120px;
                }
                .mac-keyboard::before {
                  background: 0 0;
                  border-radius: 0 0 3px 3px;
                  bottom: -2px;
                  box-shadow: -270px 0 #272727, 250px 0 #272727;
                  content: "";
                  height: 2px;
                  left: 50%;
                  margin-left: -10px;
                  position: absolute;
                  width: 40px;
                }
                .mac-notch {
                  width: 100px;
                  height: 12px;
                  position: absolute;
                  background-color: #000;
                  top: 0;
                  left: 50%;
                  transform: translateX(-50%);
                  border-radius: 0 0 6px 6px;
                  z-index: 50;
                }
                @keyframes slideShow {
                  0%   { opacity: 1; }
                  18%  { opacity: 1; }
                  22%  { opacity: 0; }
                  98%  { opacity: 0; }
                  100% { opacity: 0; }
                }
                .boq-slide {
                  position: absolute;
                  top: 0; left: 0;
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  object-position: top center;
                  opacity: 0;
                  animation: slideShow 25s infinite;
                  z-index: 1;
                }
                .boq-slide:nth-child(1) { animation-delay: 0s;  opacity: 1; }
                .boq-slide:nth-child(2) { animation-delay: 5s;  }
                .boq-slide:nth-child(3) { animation-delay: 10s; }
                .boq-slide:nth-child(4) { animation-delay: 15s; }
                .boq-slide:nth-child(5) { animation-delay: 20s; }
              `}</style>

              <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>

                {/* Screen */}
                <div className="mac-screen">
                  <div className="mac-notch" />
                  <div style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    right: 10,
                    bottom: 24,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#f8fafc',
                    zIndex: 2
                  }}>
                    <img className="boq-slide" src="/boq-screens/screen1.png" alt="s1" />
                    <img className="boq-slide" src="/boq-screens/screen2.png" alt="s2" />
                    <img className="boq-slide" src="/boq-screens/screen3.png" alt="s3" />
                    <img className="boq-slide" src="/boq-screens/screen4.png" alt="s4" />
                    <img className="boq-slide" src="/boq-screens/screen5.png" alt="s5" />
                  </div>
                </div>

                {/* Keyboard */}
                <div className="mac-keyboard" />

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="fade-in" style={{
        background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
        padding: '96px 48px'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-block', padding: '4px 14px',
              borderRadius: 999, background: '#fff', color: '#4338ca',
              fontSize: 12, fontWeight: 600, marginBottom: 16,
              textTransform: 'uppercase', letterSpacing: 0.5
            }}>How it works</div>
            <h2 style={{
              fontSize: 38, fontWeight: 800, color: '#1a1a2e',
              letterSpacing: -1
            }}>
              <AnimatedHeading text="Three steps to your first BOQ" />
            </h2>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
            gap: 32, position: 'relative'
          }}>
            {[
              { n: 1, title: 'Create your project', desc: 'Set up a new construction or interior project and invite your team with the right roles.' },
              { n: 2, title: 'Build your BOQ', desc: 'Add materials from the registry or sketch your plan — quantities generate automatically.' },
              { n: 3, title: 'Approve & procure', desc: 'Finance finalizes the BOQ, purchase team raises POs and site engineers track delivery.' },
            ].map(s => (
              <div key={s.n} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: '#4338ca', color: '#fff',
                  fontSize: 22, fontWeight: 800,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', margin: '0 auto 20px',
                  boxShadow: '0 4px 16px rgba(67,56,202,0.3)'
                }}>{s.n}</div>
                <h3 style={{
                  fontSize: 17, fontWeight: 700,
                  color: '#1a1a2e', marginBottom: 8
                }}>{s.title}</h3>
                <p style={{
                  fontSize: 14, color: '#64748b',
                  lineHeight: 1.6
                }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: '#1a1a2e', padding: '96px 48px', textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: 42, fontWeight: 800, color: '#fff',
          letterSpacing: -1, marginBottom: 16
        }}>Ready to build your first BOQ?</h2>
        <p style={{
          fontSize: 17, color: '#94a3b8', marginBottom: 40,
          maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7
        }}>
          Join construction and interior fit-out teams already using
          BUILDESTIMATE to save time and eliminate budget overruns.
        </p>
        <div style={{
          display: 'flex', gap: 16,
          justifyContent: 'center', flexWrap: 'wrap'
        }}>
          <Link href="/login">
            <button style={{
              padding: '14px 32px', borderRadius: 12, border: 'none',
              background: '#fff', fontSize: 16, fontWeight: 600,
              color: '#4338ca', cursor: 'pointer'
            }}>Sign In to Dashboard</button>
          </Link>
          <Link href="/signup">
            <button style={{
              padding: '14px 32px', borderRadius: 12,
              border: '2px solid rgba(255,255,255,0.3)',
              background: 'transparent', fontSize: 16, fontWeight: 600,
              color: '#fff', cursor: 'pointer'
            }}>Create Free Account</button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: '#111827', padding: '32px 48px', textAlign: 'center'
      }}>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          © 2026 BUILDESTIMATE — BOQ Management System.
          Built for construction & interior fit-out teams.
        </p>
      </footer>

      <style>{`
        .fade-in { opacity: 0; transform: translateY(30px); 
                   transition: all 0.6s ease; }
        .fade-in.visible { opacity: 1; transform: translateY(0); }
        @keyframes letterReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .fade-in.visible .card-animate {
          animation: cardReveal 0.7s ease forwards;
        }
        @keyframes cardReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .fade-in:not(.visible) span[style*="letterReveal"] {
          opacity: 0 !important;
          transform: translateY(20px) !important;
          animation: none !important;
        }
        .fade-in.visible span[style*="letterReveal"] {
          animation: letterReveal 0.6s ease forwards;
        }
      `}</style>
    </div>
  );
}
