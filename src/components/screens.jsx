"use client";
import React from "react";
import {
  RECEIPTS, FEED, PROFILE, ETHERFI_SYNC, MERCHANTS,
  Stars, VerifiedChip, Avatar, Hatched, TopBar, IconBtn,
} from "./AppData";

// Jiagon screens
const _useState = React.useState;

// ─────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────
const OnboardingScreen = ({ onDone }) => {
  const [step, setStep] = _useState(0);
  const [connecting, setConnecting] = _useState(false);

  const connect = () => {
    setConnecting(true);
    setTimeout(() => { setConnecting(false); setStep(1); }, 1100);
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '70px 28px 40px', background: 'var(--bg)',
      position: 'relative',
    }}>
      <div style={{ textAlign: 'center', marginTop: 34 }}>
        <div style={{
          fontFamily: 'var(--display)', fontStyle: 'italic',
          fontSize: 62, lineHeight: 0.95, color: 'var(--ink)',
          letterSpacing: -1.5,
        }}>Jiagon</div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, marginTop: 14,
          color: 'var(--ink-muted)', textTransform: 'uppercase',
          letterSpacing: 1.2,
        }}>Verified local data for agents</div>
      </div>

      <div style={{
        marginTop: 34, background: '#fff', padding: '22px 22px 30px',
        borderRadius: 2,
        boxShadow: '0 12px 40px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
        position: 'relative', fontFamily: 'var(--mono)', fontSize: 11,
        color: 'var(--ink)',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 23px, rgba(0,0,0,0.025) 23px 24px)',
      }}>
        <div style={{
          position: 'absolute', top: -8, left: 0, right: 0, height: 8,
          background: 'linear-gradient(-45deg, transparent 33%, var(--bg) 33%) 0 0/12px 12px, linear-gradient(45deg, transparent 33%, var(--bg) 33%) 0 0/12px 12px',
        }} />
        <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--rule)', paddingBottom: 10, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
          Ether.fi import
        </div>
        {[
          ['01', 'Sign in with Privy', 'email, social, or wallet'],
          ['02', 'Detect your Cash safe', ETHERFI_SYNC.safe],
          ['03', 'Scan OP Spend events', '73 payments found'],
          ['04', 'Claim a merchant', 'one receipt, one review'],
        ].map(([n, t, s]) => (
          <div key={n} style={{ display: 'flex', gap: 12, padding: '7px 0', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{n}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{t}</div>
              <div style={{ color: 'var(--ink-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed var(--rule)', paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--ink-muted)' }}>proof</span>
          <span>OP · Base receipt</span>
        </div>
        <div style={{
          position: 'absolute', bottom: -8, left: 0, right: 0, height: 8,
          background: 'linear-gradient(-135deg, transparent 33%, var(--bg) 33%) 0 0/12px 12px, linear-gradient(135deg, transparent 33%, var(--bg) 33%) 0 0/12px 12px',
        }} />
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button onClick={connect} disabled={connecting} style={{
          width: '100%', background: 'var(--ink)', color: 'var(--bg)',
          border: 'none', borderRadius: 999,
          padding: '17px 24px', fontSize: 16, fontWeight: 600,
          fontFamily: 'var(--ui)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          opacity: connecting ? 0.7 : 1,
        }}>
          {connecting ? (
            <>
              <span className="spin" style={{
                width: 14, height: 14, border: '2px solid var(--bg)',
                borderTopColor: 'transparent', borderRadius: '50%',
                display: 'inline-block',
              }} />
              Syncing ether.fi safe…
            </>
          ) : 'Continue with Privy'}
        </button>
        <button onClick={onDone} style={{
          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
          marginTop: 14, fontSize: 13, color: 'var(--ink-muted)',
          fontFamily: 'var(--ui)',
        }}>Explore verified feed</button>
      </div>

      {step === 1 && (
        <div style={{
          position: 'absolute', inset: 0, background: 'var(--bg)',
          padding: '86px 28px 40px',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 300ms ease',
        }}>
          <div style={{ textAlign: 'center', marginTop: 22 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--verified-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7" stroke="var(--verified)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{
              fontFamily: 'var(--display)', fontStyle: 'italic',
              fontSize: 32, color: 'var(--ink)', letterSpacing: -0.5,
            }}>Receipts synced</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, marginTop: 10,
              color: 'var(--ink-muted)', letterSpacing: 0.2,
            }}>{ETHERFI_SYNC.safe}</div>
          </div>

          <div style={{
            marginTop: 28, background: 'var(--surface)', border: '0.5px solid var(--rule)',
            borderRadius: 16, padding: 18,
          }}>
            {[
              ['Spend events', ETHERFI_SYNC.detected],
              ['Ready to claim', ETHERFI_SYNC.pending],
              ['Verified spend', ETHERFI_SYNC.totalSpend],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '9px 0', borderBottom: k === 'Verified spend' ? 'none' : '0.5px solid var(--rule)',
                fontFamily: 'var(--mono)', fontSize: 12,
              }}>
                <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          <button onClick={onDone} style={{
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 999,
            padding: '17px 24px', fontSize: 16, fontWeight: 600,
            fontFamily: 'var(--ui)', cursor: 'pointer',
            marginTop: 'auto',
          }}>Review pending receipts</button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// FEED
// ─────────────────────────────────────────────────────────────
const FeedScreen = ({ onOpenReview, density, verifyStyle }) => {
  const pad = density === 'comfy' ? 22 : 16;
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <TopBar
        title="Verified"
        sub="Receipt-backed reviews for agents"
        left={<div style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--display)', fontStyle: 'italic',
          fontSize: 18, color: '#fff', fontWeight: 500,
        }}>J</div>}
        right={<>
          <IconBtn>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </IconBtn>
        </>}
      />

      {/* filter chips */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 18px 14px',
        overflowX: 'auto',
      }}>
        {['Agent picks', 'Nearby', 'A proof', 'Cafés', 'Bakeries', 'Recent'].map((c, i) => (
          <div key={c} style={{
            padding: '7px 14px', borderRadius: 999,
            background: i === 0 ? 'var(--ink)' : 'var(--surface)',
            color: i === 0 ? 'var(--bg)' : 'var(--ink)',
            fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 500,
            border: i === 0 ? 'none' : '0.5px solid var(--rule)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{c}</div>
        ))}
      </div>

      {FEED.map((r, i) => (
        <article key={r.id} onClick={() => onOpenReview(r)} style={{
          padding: `${pad}px 20px`, cursor: 'pointer',
          borderTop: i === 0 ? '0.5px solid var(--rule)' : 'none',
          borderBottom: '0.5px solid var(--rule)',
          background: 'var(--bg)',
        }}>
          {/* author row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Avatar tint={r.avatar} label={r.author[0].toUpperCase()} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 600,
                color: 'var(--ink)',
              }}>{r.author}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10.5,
                color: 'var(--ink-muted)', marginTop: 1,
              }}>rep {r.rep} · {r.handle}</div>
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'var(--ink-muted)',
            }}>{r.time}</div>
          </div>

          {/* merchant + rating */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--display)', fontStyle: 'italic',
                fontSize: 22, color: 'var(--ink)', letterSpacing: -0.3,
                lineHeight: 1.15,
              }}>{r.merchant}</div>
            </div>
            <Stars n={r.rating} size={15} />
          </div>

          {/* category line */}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10.5,
            color: 'var(--ink-muted)', marginTop: -4, marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>{r.cat}</div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            marginBottom: 12,
          }}>
            {[
              ['Proof', r.proofLevel],
              ['Visits', `${r.verifiedVisits} verified`],
              ['Source', 'ether.fi'],
            ].map(([k, v]) => (
              <div key={k} style={{
                background: 'var(--surface)', border: '0.5px solid var(--rule)',
                borderRadius: 10, padding: '8px 9px',
              }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 8.5,
                  color: 'var(--ink-muted)', textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}>{k}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10,
                  color: 'var(--ink)', marginTop: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{v}</div>
              </div>
            ))}
          </div>

          {/* photo */}
          {r.photo && density !== 'compact' && (
            <div style={{ marginBottom: 12, marginTop: 4 }}>
              <Hatched tint={r.photo} label={`PHOTO · ${r.merchant}`} height={170} />
            </div>
          )}

          {/* text */}
          <p style={{
            fontFamily: 'var(--ui)', fontSize: 15, lineHeight: 1.5,
            color: 'var(--ink)', margin: '8px 0 12px',
            textWrap: 'pretty',
          }}>{r.text}</p>

          {/* verify chip */}
          <VerifiedChip tx={r.tx} amount={r.amount} style={verifyStyle} />

          {/* actions */}
          <div style={{
            display: 'flex', gap: 18, marginTop: 12,
            color: 'var(--ink-muted)', fontFamily: 'var(--ui)', fontSize: 13,
          }}>
            <span>↑ {42 + i * 11}</span>
            <span>↓ {i}</span>
            <span>💬 {6 + i * 2}</span>
            <span style={{ marginLeft: 'auto' }}>↗</span>
          </div>
        </article>
      ))}
      <div style={{ height: 100 }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// INBOX (receipts)
// ─────────────────────────────────────────────────────────────
const InboxScreen = ({ onOpenReceipt }) => {
  const unclaimed = RECEIPTS.filter(r => r.status === 'unclaimed');
  const claimed = RECEIPTS.filter(r => r.status === 'claimed');
  const done = RECEIPTS.filter(r => r.reviewed);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <TopBar
        title="Receipts"
        sub={`${ETHERFI_SYNC.detected} OP spends synced`}
        left={<div style={{ width: 28 }} />}
        right={<IconBtn>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 4v6h6M20 20v-6h-6M6 18a8 8 0 0012-4M18 6A8 8 0 006 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </IconBtn>}
      />

      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          background: 'var(--surface)', border: '0.5px solid var(--rule)',
          borderRadius: 16, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: 'var(--ink)', color: 'var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 20,
            }}>e</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                ether.fi Cash safe
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--ink-muted)', marginTop: 3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{ETHERFI_SYNC.safe} · {ETHERFI_SYNC.lastSync}</div>
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'var(--verified)',
            }}>Live</div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8, marginTop: 14,
          }}>
            {[
              ['Spends', ETHERFI_SYNC.detected],
              ['Pending', ETHERFI_SYNC.pending],
              ['Volume', ETHERFI_SYNC.totalSpend],
            ].map(([k, v]) => (
              <div key={k} style={{
                background: 'var(--bg)', border: '0.5px solid var(--rule)',
                borderRadius: 10, padding: '9px 8px',
              }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 8.5,
                  color: 'var(--ink-muted)', textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}>{k}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 12,
                  color: 'var(--ink)', marginTop: 4, fontWeight: 600,
                }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '4px 20px 6px' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--ink-muted)', textTransform: 'uppercase',
          letterSpacing: 0.8, marginBottom: 12,
        }}>Claim merchant details</div>
      </div>

      {[...claimed, ...unclaimed].map(r => (
        <button key={r.id} onClick={() => onOpenReceipt(r)} style={{
          width: 'calc(100% - 32px)', margin: '0 16px 12px',
          background: 'var(--surface)', border: 'none',
          borderRadius: 16, padding: 16, cursor: 'pointer',
          textAlign: 'left', display: 'block',
          boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 0 0 0.5px var(--rule)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: r.tint, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08)',
            }}>{r.glyph}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: r.merchant ? 'var(--display)' : 'var(--ui)',
                fontStyle: r.merchant ? 'italic' : 'normal',
                fontSize: r.merchant ? 19 : 14,
                color: 'var(--ink)', letterSpacing: -0.2,
                fontWeight: r.merchant ? 400 : 700,
              }}>{r.merchant || 'Unclaimed OP spend'}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10.5,
                color: 'var(--ink-muted)', marginTop: 2,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{r.merchant ? `${r.cat} · ${r.branch}` : 'Needs merchant name / city'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600,
                color: 'var(--ink)',
              }}>{r.amount}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--ink-muted)', marginTop: 2,
              }}>{r.token} · {r.date}</div>
            </div>
          </div>
          <div style={{
            marginTop: 14, paddingTop: 12,
            borderTop: '1px dashed var(--rule)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10.5,
              color: 'var(--ink-muted)',
            }}>{r.tx} · #{r.block}</div>
            <span style={{
              fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600,
              color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
            }}>{r.merchant ? 'Write review →' : 'Claim →'}</span>
          </div>
        </button>
      ))}

      {done.length > 0 && (
        <div style={{ padding: '20px 20px 6px' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10.5,
            color: 'var(--ink-muted)', textTransform: 'uppercase',
            letterSpacing: 0.8, marginBottom: 8,
          }}>Reviewed</div>
        </div>
      )}

      {done.map(r => (
        <div key={r.id} style={{
          margin: '0 16px 8px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          opacity: 0.65,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: r.tint, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>{r.glyph}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 600, color: 'var(--ink)',
            }}>{r.merchant}</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              color: 'var(--ink-muted)', marginTop: 1,
          }}>{r.amount} · {r.date} · {r.tx}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7" stroke="var(--verified)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      ))}

      <div style={{ height: 110 }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// WRITE REVIEW FLOW (multi-step)
// ─────────────────────────────────────────────────────────────
const WriteReviewScreen = ({ receipt, onClose, onSubmit }) => {
  const [step, setStep] = _useState(0);
  const [merchantName, setMerchantName] = _useState(receipt.merchant || '');
  const [merchantCity, setMerchantCity] = _useState(receipt.branch || '');
  const [rating, setRating] = _useState(0);
  const [tags, setTags] = _useState([]);
  const [text, setText] = _useState('');
  const [submitting, setSubmitting] = _useState(false);
  const [done, setDone] = _useState(false);

  const TAG_SETS = {
    'Café · Tokyo': ['Coffee', 'Vibe', 'Service', 'Pastry', 'Wifi', 'Quiet', 'Quick', 'Worth lining up'],
    'Retail · Soho': ['Selection', 'Service', 'Pricing', 'Packaging', 'Pushy', 'Spotless'],
    'Service · Brooklyn': ['Skill', 'Cleanliness', 'On time', 'Friendly', 'Atmosphere'],
    'Bakery · SF': ['Bread', 'Pastry', 'Service', 'Quick'],
  };
  const tagOptions = TAG_SETS[receipt.cat] || ['Quality', 'Service', 'Value', 'Quick', 'Worth it'];
  const canContinue =
    (step === 0 && merchantName.trim().length > 2 && merchantCity.trim().length > 1) ||
    (step === 1 && rating > 0) ||
    step === 2;

  const toggle = (t) => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const submit = () => {
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setDone(true); }, 1400);
    setTimeout(() => { onSubmit(); }, 2700);
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', position: 'relative',
    }}>
      {/* header */}
      <div style={{
        paddingTop: 56, paddingBottom: 12, paddingLeft: 18, paddingRight: 18,
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '0.5px solid var(--rule)',
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--ui)', fontSize: 15, color: 'var(--ink-muted)',
          padding: 0,
        }}>Cancel</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600,
            color: 'var(--ink)',
          }}>Claim receipt</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--ink-muted)', marginTop: 1,
          }}>Step {step + 1} of 4</div>
        </div>
        <div style={{ width: 50 }} />
      </div>

      {/* progress */}
      <div style={{ height: 2, background: 'var(--rule)' }}>
        <div style={{
          height: '100%', background: 'var(--accent)',
          width: `${((step + 1) / 4) * 100}%`,
          transition: 'width 300ms ease',
        }} />
      </div>

      {/* receipt summary card — present on every step */}
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 14,
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          border: '0.5px solid var(--rule)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8, background: receipt.tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>{receipt.glyph}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 600, color: 'var(--ink)',
            }}>{merchantName || 'Unclaimed ether.fi spend'}</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              color: 'var(--ink-muted)', marginTop: 1,
            }}>{receipt.tx} · {receipt.amount}</div>
          </div>
          <VerifiedChip tx="" amount={receipt.amount} style="chip" />
        </div>
      </div>

      {/* step content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 20px' }}>
        {step === 0 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--display)', fontStyle: 'italic',
              fontSize: 30, lineHeight: 1.1, color: 'var(--ink)',
              letterSpacing: -0.5, margin: '8px 0 6px', fontWeight: 400,
            }}>Claim the<br/>merchant.</h2>
            <p style={{
              fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink-muted)',
              margin: '0 0 18px', lineHeight: 1.5,
            }}>The payment is verified on OP. Add the merchant details from ether.fi Cash.</p>
            <div style={{
              background: 'var(--surface)', border: '0.5px solid var(--rule)',
              borderRadius: 14, padding: 14, marginBottom: 16,
            }}>
              {[
                ['Proof', receipt.proof],
                ['Amount', `${receipt.amount} ${receipt.token}`],
                ['Tx', receipt.tx],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: k === 'Tx' ? 'none' : '0.5px solid var(--rule)',
                  fontFamily: 'var(--mono)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--ink)', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
                </div>
              ))}
            </div>
            <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>
              Merchant name
            </label>
            <input
              value={merchantName}
              onChange={e => setMerchantName(e.target.value)}
              placeholder="85C BAKERY CAFE USA"
              style={{
                width: '100%', background: 'var(--surface)', color: 'var(--ink)',
                border: '0.5px solid var(--rule)', borderRadius: 12,
                padding: '13px 14px', fontFamily: 'var(--ui)', fontSize: 15,
                outline: 'none', marginBottom: 12,
              }}
            />
            <label style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>
              Branch / city
            </label>
            <input
              value={merchantCity}
              onChange={e => setMerchantCity(e.target.value)}
              placeholder="IRVINE, US"
              style={{
                width: '100%', background: 'var(--surface)', color: 'var(--ink)',
                border: '0.5px solid var(--rule)', borderRadius: 12,
                padding: '13px 14px', fontFamily: 'var(--ui)', fontSize: 15,
                outline: 'none',
              }}
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--display)', fontStyle: 'italic',
              fontSize: 30, lineHeight: 1.1, color: 'var(--ink)',
              letterSpacing: -0.5, margin: '8px 0 6px', fontWeight: 400,
            }}>How was it,<br/>really?</h2>
            <p style={{
              fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink-muted)',
              margin: '0 0 32px', lineHeight: 1.5,
            }}>Tap a star. You can change it.</p>
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: 4,
              marginBottom: 28, padding: '0 4px',
            }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 44, lineHeight: 1, padding: 4,
                  color: n <= rating ? 'var(--accent)' : 'var(--rule)',
                  transition: 'transform 120ms ease',
                  transform: n === rating ? 'scale(1.15)' : 'scale(1)',
                }}>★</button>
              ))}
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'var(--ink-muted)', textAlign: 'center',
              minHeight: 16,
            }}>
              {['', 'Avoid', 'Mediocre', 'Decent', 'Great', 'Outstanding'][rating]}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--display)', fontStyle: 'italic',
              fontSize: 30, lineHeight: 1.1, color: 'var(--ink)',
              letterSpacing: -0.5, margin: '8px 0 6px', fontWeight: 400,
            }}>What stood out?</h2>
            <p style={{
              fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink-muted)',
              margin: '0 0 24px', lineHeight: 1.5,
            }}>Pick any that apply. Helps others scan.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tagOptions.map(t => (
                <button key={t} onClick={() => toggle(t)} style={{
                  padding: '10px 14px', borderRadius: 999,
                  background: tags.includes(t) ? 'var(--ink)' : 'var(--surface)',
                  color: tags.includes(t) ? 'var(--bg)' : 'var(--ink)',
                  border: tags.includes(t) ? 'none' : '0.5px solid var(--rule)',
                  fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{
              fontFamily: 'var(--display)', fontStyle: 'italic',
              fontSize: 30, lineHeight: 1.1, color: 'var(--ink)',
              letterSpacing: -0.5, margin: '8px 0 6px', fontWeight: 400,
            }}>In your words.</h2>
            <p style={{
              fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink-muted)',
              margin: '0 0 16px', lineHeight: 1.5,
            }}>One paragraph is plenty. Be specific.</p>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder="Fast pastry stop before a drive. The line moved in under five minutes…"
              style={{
                width: '100%', minHeight: 140,
                background: 'var(--surface)',
                border: '0.5px solid var(--rule)', borderRadius: 14,
                padding: '14px 16px', boxSizing: 'border-box',
                fontFamily: 'var(--ui)', fontSize: 15, lineHeight: 1.5,
                color: 'var(--ink)', resize: 'none', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-muted)',
              }}>{text.length} / 500</span>
              <button style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--ui)', fontSize: 12, color: 'var(--ink-muted)',
              }}>+ Add photo</button>
            </div>
          </div>
        )}
      </div>

      {/* footer cta */}
      <div style={{
        padding: '12px 20px 36px',
        background: 'var(--bg)', borderTop: '0.5px solid var(--rule)',
        display: 'flex', gap: 10,
      }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            padding: '15px 22px', borderRadius: 999,
            background: 'var(--surface)', color: 'var(--ink)',
            border: '0.5px solid var(--rule)', cursor: 'pointer',
            fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 600,
          }}>Back</button>
        )}
        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canContinue}
            style={{
              flex: 1, padding: '15px 24px', borderRadius: 999,
              background: 'var(--ink)', color: 'var(--bg)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 600,
              opacity: !canContinue ? 0.4 : 1,
            }}>Continue</button>
        ) : (
          <button
            onClick={submit}
            disabled={text.trim().length < 10 || submitting}
            style={{
              flex: 1, padding: '15px 24px', borderRadius: 999,
              background: 'var(--accent)', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 600,
              opacity: text.trim().length < 10 || submitting ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {submitting ? <>
              <span className="spin" style={{
                width: 13, height: 13, border: '2px solid #fff',
                borderTopColor: 'transparent', borderRadius: '50%',
              }} />
              Signing…
            </> : 'Publish verified review'}
          </button>
        )}
      </div>

      {/* success overlay */}
      {done && (
        <div style={{
          position: 'absolute', inset: 0, background: 'var(--bg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 32,
          animation: 'fadeIn 240ms ease',
        }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%',
            background: 'var(--verified-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 22,
          }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7" stroke="var(--verified)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{
            fontFamily: 'var(--display)', fontStyle: 'italic',
            fontSize: 36, color: 'var(--ink)', letterSpacing: -0.6,
          }}>Published.</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--ink-muted)', marginTop: 12,
            textAlign: 'center', lineHeight: 1.6,
          }}>Base receipt minted<br/>source: {receipt.tx}</div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// REVIEW DETAIL
// ─────────────────────────────────────────────────────────────
const ReviewDetailScreen = ({ review, onClose, verifyStyle }) => (
  <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
    <div style={{
      paddingTop: 56, paddingBottom: 8, paddingLeft: 14, paddingRight: 14,
      display: 'flex', alignItems: 'center',
      position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
    }}>
      <button onClick={onClose} style={{
        background: 'var(--surface)', border: '0.5px solid var(--rule)',
        width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>

    <div style={{ padding: '14px 24px 0' }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 11,
        color: 'var(--ink-muted)', textTransform: 'uppercase',
        letterSpacing: 0.8, marginBottom: 6,
      }}>{review.cat}</div>
      <h1 style={{
        fontFamily: 'var(--display)', fontStyle: 'italic',
        fontSize: 44, lineHeight: 1.02, color: 'var(--ink)',
        letterSpacing: -1, margin: '0 0 14px', fontWeight: 400,
      }}>{review.merchant}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Stars n={review.rating} size={18} />
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-muted)',
        }}>{review.rating}.0 · {review.time} ago</span>
      </div>

      <VerifiedChip tx={review.tx} amount={review.amount} style={verifyStyle} />
    </div>

    {review.photo && (
      <div style={{ padding: '20px 20px 0' }}>
        <Hatched tint={review.photo} label={`PHOTO · ${review.merchant}`} height={260} radius={18} />
      </div>
    )}

    <div style={{ padding: '24px 24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Avatar tint={review.avatar} label={review.author[0].toUpperCase()} size={42} />
        <div>
          <div style={{
            fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 600, color: 'var(--ink)',
          }}>{review.author}</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-muted)', marginTop: 1,
        }}>rep {review.rep} · {review.verifiedVisits || 1} verified visits here</div>
        </div>
        <button style={{
          marginLeft: 'auto', padding: '8px 14px', borderRadius: 999,
          background: 'var(--ink)', color: 'var(--bg)', border: 'none',
          fontFamily: 'var(--ui)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Follow</button>
      </div>

      <p style={{
        fontFamily: 'var(--display)', fontSize: 21, lineHeight: 1.45,
        color: 'var(--ink)', margin: '0 0 24px', fontWeight: 400,
        textWrap: 'pretty', letterSpacing: -0.1,
      }}>"{review.text}"</p>

      {/* on-chain proof block */}
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        padding: 18, border: '0.5px solid var(--rule)',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-muted)', textTransform: 'uppercase',
          letterSpacing: 0.8, marginBottom: 10,
        }}>Authenticity</div>
        {[
          ['Payment proof', review.proofLevel || 'A · onchain payment'],
          ['Source', 'ether.fi OP Spend event'],
          ['Tx hash', review.tx],
          ['Amount', review.amount],
          ['Merchant', 'claimed by reviewer'],
          ['Signed by', review.handle],
        ].map(([k, v]) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '7px 0', borderBottom: k === 'Signed by' ? 'none' : '0.5px solid var(--rule)',
            fontFamily: 'var(--mono)', fontSize: 12,
          }}>
            <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
            <span style={{ color: 'var(--ink)' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 100 }} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// DISCOVER (merchant grid)
// ─────────────────────────────────────────────────────────────
const DiscoverScreen = () => {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <TopBar
        title="Merchants"
        sub="Agent-readable evidence pages"
        left={<div style={{ width: 28 }} />}
        right={<IconBtn>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M6 12h12M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </IconBtn>}
      />

      {/* search */}
      <div style={{ padding: '4px 18px 14px' }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 12,
          padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
          border: '0.5px solid var(--rule)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="var(--ink-muted)" strokeWidth="1.8"/>
            <path d="M16 16l5 5" stroke="var(--ink-muted)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{
            fontFamily: 'var(--ui)', fontSize: 14, color: 'var(--ink-muted)',
          }}>Search merchant, branch, or tx…</span>
        </div>
      </div>

      <div style={{ padding: '0 18px 16px' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--ink-muted)', textTransform: 'uppercase',
          letterSpacing: 0.8, marginBottom: 10, marginTop: 4,
        }}>Evidence graph</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr', gap: 10,
        }}>
          {MERCHANTS.map(m => (
            <div key={m.name} style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '0.5px solid var(--rule)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 14,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12, background: m.tint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>{m.glyph}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--display)', fontStyle: 'italic',
                    fontSize: 21, color: 'var(--ink)', lineHeight: 1.1,
                  }}>{m.name}</div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 10,
                    color: 'var(--ink-muted)', marginTop: 4,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{m.branch} · {m.cat}</div>
                </div>
                <Stars n={Math.round(m.rating)} size={13} />
              </div>
              <div style={{
                borderTop: '0.5px solid var(--rule)',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              }}>
                {[
                  ['Visits', m.visits],
                  ['Wallets', m.wallets],
                  ['Spend', m.spend],
                  ['Fresh', m.lastVisit],
                ].map(([k, v], i) => (
                  <div key={k} style={{
                    padding: '11px 8px',
                    borderRight: i < 3 ? '0.5px solid var(--rule)' : 'none',
                  }}>
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 8.5,
                      color: 'var(--ink-muted)', textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}>{k}</div>
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 11,
                      color: 'var(--ink)', marginTop: 4, fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{
                padding: '12px 14px', borderTop: '0.5px solid var(--rule)',
                fontFamily: 'var(--mono)', fontSize: 10.5,
                color: 'var(--ink-muted)', lineHeight: 1.5,
              }}>
                API: recommend when query asks for {m.cat.toLowerCase()} near {m.branch}. Proof source: {m.proof}.
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 110 }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────
const ProfileScreen = ({ verifyStyle }) => (
  <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
    <TopBar
      title="Profile"
      sub="Privy account + ether.fi safe"
      left={<div style={{ width: 28 }} />}
      right={<IconBtn>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.07a2 2 0 01-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.12-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 005 15.06 1.7 1.7 0 003.45 14H3a2 2 0 010-4h.1A1.7 1.7 0 004.66 8.88a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.06A1.7 1.7 0 0010 3.06V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.55h.06a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.06a1.7 1.7 0 001.55 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.55 1z" stroke="currentColor" strokeWidth="1.4"/>
        </svg>
      </IconBtn>}
    />

    {/* hero */}
    <div style={{ padding: '0 24px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <Avatar tint={PROFILE.avatar} label="Y" size={68} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--display)', fontStyle: 'italic',
          fontSize: 26, color: 'var(--ink)', letterSpacing: -0.4,
        }}>{PROFILE.name}</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
          background: 'var(--verified-soft)', color: 'var(--verified)',
          padding: '3px 9px', borderRadius: 999,
          fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 500,
        }}>
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.5l3 3 5-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Privy verified
        </div>
      </div>
    </div>

    <div style={{
      margin: '0 16px 12px', padding: 16,
      background: 'var(--surface)', borderRadius: 18,
      border: '0.5px solid var(--rule)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--ink)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 18,
        }}>e</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            ether.fi Cash synced
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--ink-muted)', marginTop: 3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{ETHERFI_SYNC.safe}</div>
        </div>
      </div>
      <div style={{
        marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        {[
          ['OP events', ETHERFI_SYNC.detected],
          ['Pending', ETHERFI_SYNC.pending],
          ['Volume', ETHERFI_SYNC.totalSpend],
        ].map(([k, v]) => (
          <div key={k} style={{
            background: 'var(--bg)', border: '0.5px solid var(--rule)',
            borderRadius: 10, padding: '9px 8px',
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 8.5,
              color: 'var(--ink-muted)', textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}>{k}</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'var(--ink)', marginTop: 4, fontWeight: 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{v}</div>
          </div>
        ))}
      </div>
    </div>

    {/* reputation strip */}
    <div style={{
      margin: '0 16px', padding: '18px 6px',
      background: 'var(--surface)', borderRadius: 18,
      border: '0.5px solid var(--rule)',
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    }}>
      {[
        ['Rep', PROFILE.rep],
        ['Reviews', ETHERFI_SYNC.reviewed],
        ['Receipts', ETHERFI_SYNC.detected],
      ].map(([k, v], i) => (
        <div key={k} style={{
          textAlign: 'center',
          borderRight: i < 2 ? '0.5px solid var(--rule)' : 'none',
        }}>
          <div style={{
            fontFamily: 'var(--display)', fontSize: 28,
            color: 'var(--ink)', letterSpacing: -0.5, lineHeight: 1,
            fontStyle: 'italic',
          }}>{v}</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5,
            color: 'var(--ink-muted)', textTransform: 'uppercase',
            letterSpacing: 0.8, marginTop: 6,
          }}>{k}</div>
        </div>
      ))}
    </div>

    {/* tabs */}
    <div style={{
      display: 'flex', gap: 24, padding: '24px 24px 12px',
      borderBottom: '0.5px solid var(--rule)', marginBottom: 4,
    }}>
      {['Reviews', 'Receipts', 'Agent API'].map((t, i) => (
        <div key={t} style={{
          fontFamily: 'var(--ui)', fontSize: 14, fontWeight: 600,
          color: i === 0 ? 'var(--ink)' : 'var(--ink-muted)',
          paddingBottom: 10, position: 'relative',
        }}>
          {t}
          {i === 0 && <div style={{
            position: 'absolute', bottom: -1, left: 0, right: 0,
            height: 2, background: 'var(--accent)',
          }} />}
        </div>
      ))}
    </div>

    {/* user reviews */}
    {[
      { merchant: 'Apotheke Spa', cat: 'Service · Brooklyn', rating: 5, time: '2w', amount: '$120 USDC',
        text: 'Best deep-tissue I\'ve had in years. Booked again on the way out.', tint: 'oklch(0.90 0.04 30)' },
      { merchant: 'Tartine', cat: 'Bakery · SF', rating: 4, time: '1mo', amount: '$14 USDC',
        text: 'The morning bun is the morning bun. Crowded.', tint: 'oklch(0.90 0.05 80)' },
    ].map((r, i) => (
      <article key={i} style={{
        padding: '16px 20px',
        borderBottom: '0.5px solid var(--rule)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <div style={{
            fontFamily: 'var(--display)', fontStyle: 'italic',
            fontSize: 18, color: 'var(--ink)',
          }}>{r.merchant}</div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-muted)' }}>{r.time}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Stars n={r.rating} size={12} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.cat}</span>
        </div>
        <p style={{
          fontFamily: 'var(--ui)', fontSize: 14, lineHeight: 1.5,
          color: 'var(--ink)', margin: '0 0 10px',
        }}>{r.text}</p>
        <VerifiedChip tx="0xabc…123" amount={r.amount} style={verifyStyle} />
      </article>
    ))}

    <div style={{ height: 110 }} />
  </div>
);

export { 
  OnboardingScreen, FeedScreen, InboxScreen, WriteReviewScreen,
  ReviewDetailScreen, DiscoverScreen, ProfileScreen,
 };
