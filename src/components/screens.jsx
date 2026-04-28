"use client";
import React from "react";
import {
  PROFILE, ETHERFI_SYNC,
  Stars, VerifiedChip, Avatar, Hatched, TopBar, IconBtn,
} from "./AppData";

// Jiagon screens
const _useState = React.useState;

const SIGNAL_LABELS = {
  visitType: 'Visit',
  occasion: 'Use case',
  valueRating: 'Value',
  wouldReturn: 'Return',
  bestFor: 'Best for',
};

const PROOF_BOUNDARY_LABELS = {
  payment: ['Payment', 'Verified OP Spend'],
  merchant: ['Merchant', 'User claimed'],
  review: ['Review', 'After verified payment'],
  recommendationUse: ['Agent use', 'Ranking signal only'],
};

const titleizeSignal = (value) => String(value || '')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase());

const agentSignalsFor = (review = {}) => {
  const signals = review.agentSignals || {};
  return {
    visitType: signals.visitType || review.visitType || null,
    occasion: signals.occasion || review.occasion || null,
    valueRating: signals.valueRating || review.valueRating || null,
    wouldReturn:
      typeof signals.wouldReturn === 'boolean'
        ? signals.wouldReturn
        : typeof review.wouldReturn === 'boolean'
          ? review.wouldReturn
          : null,
    bestFor: Array.isArray(signals.bestFor)
      ? signals.bestFor
      : Array.isArray(review.bestFor)
        ? review.bestFor
        : [],
  };
};

const signalChipsFor = (review, limit = 6) => {
  const signals = agentSignalsFor(review);
  return [
    signals.visitType && titleizeSignal(signals.visitType),
    signals.occasion && titleizeSignal(signals.occasion),
    signals.valueRating && `Value ${signals.valueRating}/5`,
    typeof signals.wouldReturn === 'boolean' && `Return ${signals.wouldReturn ? 'yes' : 'no'}`,
    ...signals.bestFor.map(item => titleizeSignal(item)),
  ].filter(Boolean).slice(0, limit);
};

const hasAgentSignals = (review) => signalChipsFor(review, 1).length > 0;

const hasReviewProof = (review = {}) => Boolean(
  review.proofBoundary ||
  review.credential ||
  review.credentialTx ||
  review.tx ||
  typeof review.dataMatchesRequest === 'boolean'
);

const parseUsdAmount = (amount) => {
  const value = Number(String(amount || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(value) ? value : 0;
};

const buildMerchantSignals = (reviews = []) => {
  const groups = new Map();

  reviews
    .filter(review => review?.merchant)
    .forEach(review => {
      const branch = review.branch || String(review.cat || '').split('·')[1]?.trim() || 'Local';
      const cat = String(review.cat || 'Local').split('·')[0]?.trim() || 'Local';
      const key = `${review.merchant}|${branch}`.toLowerCase();
      const current = groups.get(key) || {
        id: key,
        name: review.merchant,
        branch,
        cat,
        tint: 'var(--place-paper)',
        glyph: review.merchant.slice(0, 1).toUpperCase(),
        ratingTotal: 0,
        ratings: 0,
        visits: 0,
        wallets: new Set(),
        spendTotal: 0,
        lastVisit: review.time || 'now',
        proof: 'published Jiagon receipt reviews',
      };

      current.visits += Number(review.verifiedVisits || 1);
      current.ratingTotal += Number(review.rating || 0);
      current.ratings += review.rating ? 1 : 0;
      current.spendTotal += parseUsdAmount(review.amount);
      if (review.handle) current.wallets.add(review.handle);
      groups.set(key, current);
    });

  return Array.from(groups.values()).map(signal => ({
    ...signal,
    wallets: Math.max(signal.wallets.size, 1),
    rating: signal.ratings ? signal.ratingTotal / signal.ratings : 0,
    spend: `$${signal.spendTotal.toFixed(2)}`,
  }));
};

const AgentSignalChips = ({ review, limit = 6 }) => {
  const chips = signalChipsFor(review, limit);
  if (!chips.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {chips.map(chip => (
        <span key={chip} style={{
          border: '0.5px solid color-mix(in oklch, var(--verified) 24%, var(--rule))',
          borderRadius: 999,
          padding: '6px 9px',
          background: 'var(--verified-soft)',
          color: 'var(--verified)',
          fontFamily: 'var(--mono)',
          fontSize: 9.5,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>{chip}</span>
      ))}
    </div>
  );
};

const AgentSignalsBlock = ({ review }) => {
  const signals = agentSignalsFor(review);
  if (!hasAgentSignals(review)) return null;

  const rows = [
    [SIGNAL_LABELS.visitType, signals.visitType ? titleizeSignal(signals.visitType) : null],
    [SIGNAL_LABELS.occasion, signals.occasion ? titleizeSignal(signals.occasion) : null],
    [SIGNAL_LABELS.valueRating, signals.valueRating ? `${signals.valueRating}/5` : null],
    [SIGNAL_LABELS.wouldReturn, typeof signals.wouldReturn === 'boolean' ? (signals.wouldReturn ? 'Yes' : 'No') : null],
    [SIGNAL_LABELS.bestFor, signals.bestFor.length ? signals.bestFor.map(titleizeSignal).join(', ') : null],
  ].filter(([, value]) => value);

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 16,
      padding: 16,
      border: '0.5px solid var(--rule)',
      marginBottom: 14,
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--ink-muted)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
      }}>Agent-readable signals</div>
      {rows.map(([k, v], index) => (
        <div key={k} style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          padding: '7px 0',
          borderBottom: index === rows.length - 1 ? 'none' : '0.5px solid var(--rule)',
          fontFamily: 'var(--mono)',
          fontSize: 11,
        }}>
          <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
          <span style={{
            color: 'var(--ink)',
            textAlign: 'right',
            maxWidth: 205,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{v}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────
const OnboardingScreen = ({ onDone, onImportDone = onDone, auth, etherfi }) => {
  const [connecting, setConnecting] = _useState(false);
  const [authError, setAuthError] = _useState("");
  const [proofInput, setProofInput] = _useState(etherfi?.sourceTx || '');
  const ready = auth?.ready ?? true;
  const authenticated = auth?.authenticated ?? false;
  const userLabel = auth?.userLabel;
  const walletLabel = auth?.walletLabel;
  const login = auth?.login;
  const synced = etherfi?.status === "synced";
  const scanning = etherfi?.status === "scanning";
  const detected = synced ? etherfi.count : ETHERFI_SYNC.detected;
  const totalSpend = synced ? `$${etherfi.totalSpendUsd}` : ETHERFI_SYNC.totalSpend;
  const pending = synced ? etherfi.receipts?.length || 0 : ETHERFI_SYNC.pending;
  const accountLabel = walletLabel || userLabel;

  const connect = async () => {
    setAuthError("");

    if (!ready || connecting) return;

    if (authenticated) {
      const spendTx = proofInput.trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(spendTx)) {
        setAuthError("Paste a valid ether.fi Cash spend transaction before importing.");
        return;
      }

      setConnecting(true);
      try {
        await etherfi?.scan?.(spendTx);
        onImportDone();
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to import ether.fi Cash receipt.");
      } finally {
        setConnecting(false);
      }
      return;
    }

    try {
      setConnecting(true);
      await login?.();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Privy login was cancelled.");
    } finally {
      setConnecting(false);
    }
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
        marginTop: 34, background: 'var(--receipt)', padding: '22px 22px 30px',
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
          Receipt import
        </div>
        {[
          ['01', 'Sign in with Privy', 'wallet, email, or social login'],
          ['02', 'Paste a supported card tx', 'ether.fi Cash OP spend tx for MVP'],
          ['03', 'Scan payment evidence', synced ? `${detected} payments found` : 'from one spend tx'],
          ['04', 'Build taste graph', 'claim merchant, then publish if useful'],
        ].map(([n, t, s]) => (
          <div key={n} style={{ display: 'flex', gap: 12, padding: '7px 0', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{n}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{t}</div>
              <div style={{ color: 'var(--ink-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</div>
            </div>
          </div>
        ))}
        {authenticated && accountLabel && (
          <div style={{
            borderTop: '1px dashed var(--rule)',
            paddingTop: 9,
            marginTop: 8,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <span style={{ color: 'var(--ink-muted)' }}>account</span>
            <span style={{
              color: 'var(--ink)',
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 168,
            }}>{accountLabel}</span>
          </div>
        )}
        {authenticated && (
          <div style={{
            borderTop: '1px dashed var(--rule)',
            paddingTop: 10,
            marginTop: 8,
          }}>
            <label style={{
              display: 'block',
              color: 'var(--ink-muted)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
            }}>Spend transaction</label>
            <input
              value={proofInput}
              onChange={e => setProofInput(e.target.value)}
              placeholder="0x spend transaction"
              spellCheck={false}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg)',
                color: 'var(--ink)',
                border: '0.5px solid var(--rule)',
                borderRadius: 8,
                padding: '9px 10px',
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                outline: 'none',
              }}
            />
          </div>
        )}
        <div style={{ borderTop: '1px dashed var(--rule)', paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--ink-muted)' }}>proof</span>
          <span>A payment · C merchant</span>
        </div>
        <div style={{
          position: 'absolute', bottom: -8, left: 0, right: 0, height: 8,
          background: 'linear-gradient(-135deg, transparent 33%, var(--bg) 33%) 0 0/12px 12px, linear-gradient(135deg, transparent 33%, var(--bg) 33%) 0 0/12px 12px',
        }} />
      </div>

      <div style={{ marginTop: 'auto' }}>
        {authError && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10.5,
            color: 'var(--accent)', textAlign: 'center',
            lineHeight: 1.45, marginBottom: 12,
          }}>{authError}</div>
        )}
        <button onClick={connect} disabled={!ready || connecting || scanning} style={{
          width: '100%', background: 'var(--ink)', color: 'var(--bg)',
          border: 'none', borderRadius: 999,
          padding: '17px 24px', fontSize: 16, fontWeight: 600,
          fontFamily: 'var(--ui)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          opacity: !ready || connecting || scanning ? 0.7 : 1,
        }}>
          {!ready ? 'Loading Privy…' : connecting || scanning ? (
            <>
              <span className="spin" style={{
                width: 14, height: 14, border: '2px solid var(--bg)',
                borderTopColor: 'transparent', borderRadius: '50%',
                display: 'inline-block',
              }} />
              Starting receipt sync…
            </>
          ) : authenticated ? 'Import from spend tx' : 'Continue with Privy'}
        </button>
        <button onClick={onDone} style={{
          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
          marginTop: 14, fontSize: 13, color: 'var(--ink-muted)',
          fontFamily: 'var(--ui)',
        }}>Explore taste feed</button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// FEED
// ─────────────────────────────────────────────────────────────
const FeedScreen = ({ onOpenReview, density, verifyStyle, userReviews = /** @type {Array<any>} */ ([]) }) => {
  const pad = density === 'comfy' ? 22 : 16;
  const [query, setQuery] = _useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const reviews = normalizedQuery
    ? userReviews.filter(review => {
      const haystack = [
        review.merchant,
        review.branch,
        review.cat,
        review.text,
        review.amount,
        review.tx,
        ...(Array.isArray(review.tags) ? review.tags : []),
        ...signalChipsFor(review, 8),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    : userReviews;
  const merchantSignals = buildMerchantSignals(reviews);
  const endpointQuery = encodeURIComponent(query.trim() || 'coffee irvine');
  const endpoint = `/api/agent/recommendations?query=${endpointQuery}&limit=3`;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <TopBar
        title="Taste"
        sub="Published taste signals for agents"
        left={<div style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--display)', fontStyle: 'italic',
          fontSize: 18, color: 'var(--panel-text)', fontWeight: 500,
        }}>J</div>}
        right={<div style={{
          border: '0.5px solid var(--rule)',
          background: 'var(--surface)',
          color: 'var(--ink-muted)',
          borderRadius: 999,
          padding: '7px 10px',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          fontWeight: 700,
        }}>API</div>}
      />

      <div style={{ padding: '4px 18px 10px' }}>
        <div style={{
          background: 'var(--surface-raised)', borderRadius: 12,
          padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10,
          border: '0.5px solid var(--rule)',
          boxShadow: '0 8px 22px oklch(0.45 0.02 110 / 0.045)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7" stroke="var(--ink-muted)" strokeWidth="1.8"/>
            <path d="M16 16l5 5" stroke="var(--ink-muted)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search coffee, Irvine, merchant, tags..."
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--ink)',
              fontFamily: 'var(--ui)',
              fontSize: 14,
            }}
          />
        </div>
      </div>

      {/* filter chips */}
      <div style={{
        display: 'flex', gap: 8, padding: '0 18px 12px',
        overflowX: 'auto',
      }}>
        {['Published', 'Receipt-backed', 'A payment', 'C merchant', 'Cafés', 'Recent'].map((c, i) => (
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

      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          background: 'var(--surface-raised)',
          color: 'var(--ink)',
          borderRadius: 16,
          padding: 14,
          border: '0.5px solid var(--rule)',
          boxShadow: '0 10px 26px oklch(0.45 0.02 110 / 0.045)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 9,
          }}>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: 'var(--verified)',
            }}>Agent API preview</div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-muted)',
              whiteSpace: 'nowrap',
            }}>{merchantSignals.length} places</div>
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 11.5,
            lineHeight: 1.45,
            fontWeight: 600,
            background: 'var(--verified-soft)',
            border: '0.5px solid var(--rule)',
            borderRadius: 10,
            padding: '9px 10px',
            wordBreak: 'break-word',
          }}>{endpoint}</div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            lineHeight: 1.45,
            color: 'var(--ink-muted)',
            marginTop: 8,
          }}>Recommendation calls rank published Taste only; private receipts stay in Receipts until reviewed.</div>
        </div>
      </div>

      {reviews.length === 0 && (
        <div style={{
          margin: '10px 18px 0',
          padding: 22,
          border: '0.5px solid var(--rule)',
          borderRadius: 16,
          background: 'var(--surface-raised)',
        }}>
          <div style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 26,
            color: 'var(--ink)',
            lineHeight: 1.05,
          }}>{userReviews.length === 0 ? 'No taste signals yet.' : 'No matching taste signals.'}</div>
          <p style={{
            fontFamily: 'var(--ui)',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--ink-muted)',
            margin: '10px 0 0',
          }}>{userReviews.length === 0 ? 'Import a verified ether.fi spend in Receipts, claim the merchant, then publish a review before this feed becomes usable by agents.' : 'Try a merchant, city, tag, or receipt proof query.'}</p>
        </div>
      )}

      {reviews.map((r, i) => (
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

          {hasAgentSignals(r) && (
            <div style={{ marginBottom: 12 }}>
              <AgentSignalChips review={r} limit={5} />
            </div>
          )}

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            marginBottom: 12,
          }}>
            {[
              ['Proof', r.proofLevel],
              ['Visits', `${r.verifiedVisits} verified`],
              ['Merchant', r.merchantProof || 'C · claimed'],
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
const toReceiptCard = (receipt, index) => ({
  id: receipt.id || `chain-${index}`,
  provider: 'ether.fi',
  merchant: null,
  branch: null,
  cat: 'Merchant not claimed',
  glyph: '$',
  tint: 'var(--place-paper)',
  amount: `$${receipt.amountUsd}`,
  token: 'OP USDC',
  date: receipt.timestamp
    ? new Date(receipt.timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : `Block ${receipt.blockNumber}`,
  tx: receipt.txShort,
  txFull: receipt.txHash,
  safe: receipt.safe,
  block: receipt.blockNumber,
  logIndex: receipt.logIndex,
  proof: receipt.proof,
  proofLevel: 'A · onchain payment',
  merchantProof: 'C · user-claimed merchant',
  privacy: 'Private until published',
  status: 'unclaimed',
  reviewed: false,
});

const credentialMode = (credential) => {
  if (!credential) return null;
  if (credential.mode) return credential.mode;
  if (credential.status === 'minted' && !credential.credentialTx) return 'already-minted';
  return credential.status;
};

const CredentialBadge = ({ credential }) => {
  if (!credential) return null;

  const mismatch = credential.dataMatchesRequest === false;
  const minted = credential.status === 'minted';
  const mode = credentialMode(credential);
  const alreadyMinted = mode === 'already-minted';
  const label = credential.credentialTx
    ? `${credential.credentialTx.slice(0, 6)}…${credential.credentialTx.slice(-4)}`
    : credential.credentialId;
  const statusLabel = mismatch
    ? 'DIFF'
    : minted
      ? alreadyMinted ? 'EXISTS' : 'MINTED'
      : 'READY';
  const tone = mismatch
    ? ['var(--accent-soft)', 'var(--accent)']
    : minted
      ? ['var(--verified-soft)', 'var(--verified)']
      : ['var(--info-soft)', 'var(--info)'];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: tone[0],
      color: tone[1],
      border: `0.5px solid color-mix(in oklch, ${tone[1]} 28%, transparent)`,
      borderRadius: 999,
      padding: '4px 8px',
      fontFamily: 'var(--mono)',
      fontSize: 9.5,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      <span>{statusLabel}</span>
      <span style={{ opacity: 0.72 }}>{label}</span>
    </div>
  );
};

const TasteMemoryPanel = ({ synced, eventCount, totalSpend, unclaimedCount, reviewedCount, lastSync, onAction, topSignals = [] }) => {
  const agentReadiness = synced
    ? unclaimedCount > 0
      ? `${eventCount} payment proofs ready. Claim merchants to unlock place-level recommendations.`
      : `${eventCount} verified taste signals ready for agent recommendations.`
    : 'Import one ether.fi spend tx to build a private taste graph from real payments.';
  const nextAction = synced
    ? unclaimedCount > 0
      ? `Claim ${Math.min(unclaimedCount, 3)} receipts`
      : 'Ask for a recommendation'
    : 'Import latest tx';

  return (
    <div style={{ padding: '0 18px 14px' }}>
      <div style={{
        background: 'var(--surface-raised)',
        color: 'var(--ink)',
        border: '0.5px solid var(--rule)',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 8px 28px rgba(49,44,36,0.06)',
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.9,
          color: 'var(--ink-muted)',
        }}>Taste graph</div>
        <div style={{
          fontFamily: 'var(--display)',
          fontStyle: 'italic',
          fontSize: 30,
          lineHeight: 1.05,
          marginTop: 8,
          letterSpacing: -0.4,
          color: 'var(--ink)',
        }}>Your receipts,<br/>usable by your agent.</div>
        <div style={{
          fontFamily: 'var(--ui)',
          fontSize: 13.5,
          lineHeight: 1.45,
          marginTop: 10,
          color: 'var(--ink-muted)',
        }}>{agentReadiness}</div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginTop: 14,
        }}>
          {[
            ['Proofs', synced ? eventCount : '—'],
            ['Spend', synced ? totalSpend : '—'],
            ['Reviews', reviewedCount],
          ].map(([k, v]) => (
            <div key={k} style={{
              border: '0.5px solid var(--rule)',
              borderRadius: 10,
              padding: '9px 8px',
              background: 'var(--bg)',
            }}>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 8.5,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                color: 'var(--ink-muted)',
              }}>{k}</div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 11.5,
                marginTop: 4,
                fontWeight: 700,
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{v}</div>
            </div>
          ))}
        </div>

        {reviewedCount > 0 && (
          <div style={{
            borderTop: '0.5px solid var(--rule)',
            marginTop: 14,
            paddingTop: 12,
          }}>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: 'var(--ink-muted)',
              marginBottom: 8,
            }}>Agent can answer</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {['Recommend from my verified reviews', 'Find places worth revisiting'].map(prompt => (
                <span key={prompt} style={{
                  border: '0.5px solid color-mix(in oklch, var(--accent) 22%, var(--rule))',
                  borderRadius: 999,
                  padding: '7px 9px',
                  fontFamily: 'var(--ui)',
                  fontSize: 11.5,
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                }}>{prompt}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 14,
          overflowX: 'auto',
          paddingBottom: 1,
        }}>
          {topSignals.map(signal => (
            <div key={signal.id} style={{
              minWidth: 136,
              border: '0.5px solid var(--rule)',
              borderRadius: 12,
              padding: 10,
              background: 'var(--bg)',
            }}>
              <div style={{
                fontFamily: 'var(--display)',
                fontStyle: 'italic',
                fontSize: 17,
                lineHeight: 1.05,
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{signal.name}</div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                color: 'var(--ink-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginTop: 5,
              }}>{signal.visits} visits · {signal.branch}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--ink-muted)',
        }}>
          <span>{lastSync}</span>
          <button
            onClick={onAction}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--accent)',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 700,
              padding: 0,
              cursor: 'pointer',
            }}
          >{nextAction} →</button>
        </div>
      </div>
    </div>
  );
};

const InboxScreen = ({ onOpenReceipt, auth, etherfi, reviewedReceiptIds = /** @type {Array<string>} */ ([]), receiptCredentials = {} }) => {
  const authenticated = auth?.authenticated ?? false;
  const ready = auth?.ready ?? true;
  const login = auth?.login;
  const [latestTx, setLatestTx] = _useState(etherfi?.sourceTx || '');
  const [importError, setImportError] = _useState("");
  React.useEffect(() => {
    if (etherfi?.sourceTx) setLatestTx(etherfi.sourceTx);
  }, [etherfi?.sourceTx]);

  const liveReceipts = etherfi?.receipts?.length
    ? etherfi.receipts.map(toReceiptCard)
    : [];
  const receiptSource = liveReceipts.map(receipt => {
    const credential = receiptCredentials[receipt.id];
    return reviewedReceiptIds.includes(receipt.id)
      ? { ...receipt, status: 'reviewed', reviewed: true, credential }
      : { ...receipt, credential };
  });
  const unclaimed = receiptSource.filter(r => r.status === 'unclaimed');
  const claimed = receiptSource.filter(r => r.status === 'claimed');
  const done = receiptSource.filter(r => r.reviewed);
  const eventCount = etherfi?.status === 'synced' ? etherfi.count : 0;
  const totalSpend = etherfi?.status === 'synced' ? `$${etherfi.totalSpendUsd}` : ETHERFI_SYNC.totalSpend;
  const safeLabel = etherfi?.safe || 'No safe scanned';
  const lastSync = etherfi?.scannedAt
    ? new Date(etherfi.scannedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : ETHERFI_SYNC.lastSync;
  const scanning = etherfi?.status === 'scanning';

  const importLatestTx = async () => {
    setImportError("");

    if (!authenticated) {
      await login?.();
      return;
    }

    try {
      await etherfi?.scan?.(latestTx);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import latest spend transaction.');
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      <TopBar
        title="Receipts"
        sub={etherfi?.status === 'synced' ? `${eventCount} private OP spends synced` : 'No private OP spends synced'}
        left={<div style={{ width: 28 }} />}
        right={<IconBtn>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 4v6h6M20 20v-6h-6M6 18a8 8 0 0012-4M18 6A8 8 0 006 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </IconBtn>}
      />

      <TasteMemoryPanel
        synced={etherfi?.status === 'synced'}
        eventCount={eventCount}
        totalSpend={totalSpend}
        unclaimedCount={unclaimed.length}
        reviewedCount={done.length}
        lastSync={lastSync}
        onAction={() => {
          if (!authenticated || etherfi?.status !== 'synced') {
            importLatestTx();
            return;
          }

          const nextReceipt = unclaimed[0] || claimed[0];
          if (nextReceipt) onOpenReceipt(nextReceipt);
        }}
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
              }}>{safeLabel} · {lastSync}</div>
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              color: etherfi?.status === 'synced' ? 'var(--verified)' : 'var(--ink-muted)',
            }}>{etherfi?.status === 'synced' ? 'Synced' : 'Idle'}</div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8, marginTop: 14,
          }}>
            {[
              ['Spends', eventCount],
              ['Pending', unclaimed.length],
              ['Volume', totalSpend],
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
          <div style={{
            display: 'flex',
            gap: 8,
            marginTop: 12,
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              color: 'var(--ink-muted)',
              background: 'var(--bg)',
              border: '0.5px solid var(--rule)',
              borderRadius: 999,
              padding: '5px 8px',
            }}>OP source proof</span>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              color: 'var(--ink-muted)',
              background: 'var(--bg)',
              border: '0.5px solid var(--rule)',
              borderRadius: 999,
              padding: '5px 8px',
            }}>BNB testnet credential</span>
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              color: 'var(--ink-muted)',
              background: 'var(--bg)',
              border: '0.5px solid var(--rule)',
              borderRadius: 999,
              padding: '5px 8px',
            }}>Greenfield object</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          background: 'var(--bg)',
          border: '0.5px solid var(--rule)',
          borderRadius: 16,
          padding: 14,
          boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: authenticated ? 10 : 0,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--ui)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--ink)',
              }}>Latest spend tx</div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 9.5,
                color: 'var(--ink-muted)',
                marginTop: 3,
              }}>{authenticated ? 'Refresh private taste graph' : 'Privy required'}</div>
            </div>
            {!authenticated && (
              <button
                onClick={importLatestTx}
                disabled={!ready}
                style={{
                  border: 'none',
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  borderRadius: 999,
                  padding: '9px 13px',
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: ready ? 'pointer' : 'default',
                  opacity: ready ? 1 : 0.6,
                }}
              >LOGIN</button>
            )}
          </div>

          {authenticated && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={latestTx}
                  onChange={e => setLatestTx(e.target.value)}
                  placeholder="Paste ether.fi Cash spend tx"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    border: '0.5px solid var(--rule)',
                    borderRadius: 10,
                    padding: '10px 11px',
                    fontFamily: 'var(--mono)',
                    fontSize: 10.5,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={importLatestTx}
                  disabled={scanning}
                  style={{
                    border: 'none',
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    borderRadius: 10,
                    padding: '0 12px',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: scanning ? 'default' : 'pointer',
                    opacity: scanning ? 0.65 : 1,
                  }}
                >{scanning ? 'SCAN' : 'IMPORT'}</button>
              </div>
              {(importError || etherfi?.error) && (
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--accent)',
                  marginTop: 8,
                  lineHeight: 1.45,
                }}>{importError || etherfi.error}</div>
              )}
            </>
          )}
        </div>
      </div>

      {receiptSource.length === 0 && (
        <div style={{
          margin: '0 16px 12px',
          padding: 18,
          background: 'var(--surface-raised)',
          border: '0.5px solid var(--rule)',
          borderRadius: 16,
        }}>
          <div style={{
            fontFamily: 'var(--display)',
            fontStyle: 'italic',
            fontSize: 24,
            color: 'var(--ink)',
          }}>No verified receipts yet.</div>
          <p style={{
            margin: '8px 0 0',
            fontFamily: 'var(--ui)',
            fontSize: 13.5,
            lineHeight: 1.45,
            color: 'var(--ink-muted)',
          }}>Paste an ether.fi Cash spend transaction to scan your account and build a private taste graph.</p>
        </div>
      )}

      <div style={{ padding: '4px 20px 6px' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--ink-muted)', textTransform: 'uppercase',
          letterSpacing: 0.8, marginBottom: 12,
        }}>Private receipts · claim merchant when ready</div>
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
              }}>{r.merchant ? `${r.cat} · ${r.branch}` : 'Payment verified · merchant unverified'}</div>
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
            }}>{r.tx} · #{r.block} · private</div>
            <span style={{
              fontFamily: 'var(--ui)', fontSize: 12, fontWeight: 600,
              color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
            }}>{r.credential ? (credentialMode(r.credential) === 'already-minted' ? 'Exists' : r.credential.status === 'minted' ? 'Minted' : 'Prepared') : r.merchant ? 'Write review →' : 'Claim →'}</span>
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
          <CredentialBadge credential={r.credential} />
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
  const [visitType, setVisitType] = _useState('quick-stop');
  const [occasion, setOccasion] = _useState('solo');
  const [valueRating, setValueRating] = _useState(0);
  const [wouldReturn, setWouldReturn] = _useState(true);
  const [bestFor, setBestFor] = _useState([]);
  const [text, setText] = _useState('');
  const [submitting, setSubmitting] = _useState(false);
  const [done, setDone] = _useState(false);
  const [mintError, setMintError] = _useState("");
  const [credential, setCredential] = _useState(null);

  const TAG_SETS = {
    'Café · Tokyo': ['Coffee', 'Vibe', 'Service', 'Pastry', 'Wifi', 'Quiet', 'Quick', 'Worth lining up'],
    'Retail · Soho': ['Selection', 'Service', 'Pricing', 'Packaging', 'Pushy', 'Spotless'],
    'Service · Brooklyn': ['Skill', 'Cleanliness', 'On time', 'Friendly', 'Atmosphere'],
    'Bakery · SF': ['Bread', 'Pastry', 'Service', 'Quick'],
  };
  const tagOptions = TAG_SETS[receipt.cat] || ['Quality', 'Service', 'Value', 'Quick', 'Worth it'];
  const visitTypeOptions = [
    ['quick-stop', 'Quick stop'],
    ['dine-in', 'Dine-in'],
    ['takeout', 'Takeout'],
    ['delivery', 'Delivery'],
  ];
  const occasionOptions = [
    ['solo', 'Solo'],
    ['work', 'Work'],
    ['date', 'Date'],
    ['group', 'Group'],
    ['commute', 'Commute'],
  ];
  const bestForOptions = ['Coffee', 'Pastry', 'Quiet', 'Fast service', 'Good value', 'Groups', 'Work session', 'Late night'];
  const credentialStatus = credential?.dataMatchesRequest === false
    ? 'Different onchain data'
    : credential?.status === 'minted'
      ? credentialMode(credential) === 'already-minted' ? 'Already minted' : 'Minted'
      : 'Prepared';
  const canContinue =
    (step === 0 && merchantName.trim().length > 2 && merchantCity.trim().length > 1) ||
    (step === 1 && rating > 0) ||
    step === 2;

  const toggle = (t) => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleBestFor = (t) => setBestFor(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const submit = async () => {
    setSubmitting(true);
    setMintError("");
    const publishedReview = {
      id: `local-${receipt.id}`,
      receiptId: receipt.id,
      author: 'you',
      handle: receipt.safe ? `${receipt.safe.slice(0, 6)}…${receipt.safe.slice(-4)}` : 'privy user',
      rep: 0,
      avatar: 'var(--avatar-warm)',
      merchant: merchantName.trim(),
      branch: merchantCity.trim(),
      cat: merchantCity.trim() ? `Local · ${merchantCity.trim()}` : 'Local',
      rating,
      visitType,
      occasion,
      valueRating: valueRating || undefined,
      wouldReturn,
      bestFor,
      time: 'now',
      text: text.trim(),
      tags,
      tx: receipt.tx,
      amount: `${receipt.amount} ${receipt.token || ''}`.trim(),
      proofLevel: receipt.proofLevel || 'A · onchain payment',
      merchantProof: 'C · user claimed',
      verifiedVisits: 1,
      photo: null,
    };

    try {
      const mintedCredential = await onSubmit(publishedReview, receipt);
      setCredential(mintedCredential);
      setSubmitting(false);
      setDone(true);
      window.setTimeout(onClose, 2200);
    } catch (error) {
      setSubmitting(false);
      setMintError(error instanceof Error ? error.message : 'Unable to mint BNB testnet receipt credential.');
    }
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
            }}>The payment is verified on OP. Merchant identity stays user-claimed until an official card API or uploaded receipt confirms it.</p>
            <div style={{
              background: 'var(--surface)', border: '0.5px solid var(--rule)',
              borderRadius: 14, padding: 14, marginBottom: 16,
            }}>
              {[
                ['Payment proof', receipt.proofLevel || receipt.proof],
                ['Merchant proof', receipt.merchantProof || 'C · user claimed'],
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
              placeholder="Merchant name from statement"
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
            }}>Pick tags and agent-readable context. This is what downstream recommendation calls can rank on.</p>
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)',
                textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
              }}>Visit type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {visitTypeOptions.map(([value, label]) => (
                  <button key={value} onClick={() => setVisitType(value)} style={{
                    padding: '9px 12px', borderRadius: 10,
                    background: visitType === value ? 'var(--ink)' : 'var(--surface)',
                    color: visitType === value ? 'var(--bg)' : 'var(--ink)',
                    border: visitType === value ? 'none' : '0.5px solid var(--rule)',
                    fontFamily: 'var(--ui)', fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer',
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)',
                textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
              }}>Occasion</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {occasionOptions.map(([value, label]) => (
                  <button key={value} onClick={() => setOccasion(value)} style={{
                    padding: '9px 12px', borderRadius: 10,
                    background: occasion === value ? 'var(--accent)' : 'var(--surface)',
                    color: occasion === value ? 'var(--panel-text)' : 'var(--ink)',
                    border: occasion === value ? 'none' : '0.5px solid var(--rule)',
                    fontFamily: 'var(--ui)', fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer',
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 20,
            }}>
              <div style={{
                background: 'var(--surface)',
                border: '0.5px solid var(--rule)',
                borderRadius: 14,
                padding: 12,
              }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
                }}>Value</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setValueRating(n)} style={{
                      flex: 1,
                      height: 30,
                      borderRadius: 8,
                      border: 'none',
                      background: n <= valueRating ? 'var(--accent)' : 'var(--bg)',
                      color: n <= valueRating ? 'var(--panel-text)' : 'var(--ink-muted)',
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => setWouldReturn(v => !v)} style={{
                background: wouldReturn ? 'var(--verified-soft)' : 'var(--surface)',
                border: '0.5px solid var(--rule)',
                borderRadius: 14,
                padding: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)',
                  textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
                }}>Return?</div>
                <div style={{
                  fontFamily: 'var(--ui)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: wouldReturn ? 'var(--verified)' : 'var(--ink)',
                }}>{wouldReturn ? 'Yes' : 'No'}</div>
              </button>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)',
                textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
              }}>Best for</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {bestForOptions.map(t => (
                  <button key={t} onClick={() => toggleBestFor(t)} style={{
                    padding: '9px 12px', borderRadius: 999,
                    background: bestFor.includes(t) ? 'var(--ink)' : 'var(--surface)',
                    color: bestFor.includes(t) ? 'var(--bg)' : 'var(--ink)',
                    border: bestFor.includes(t) ? 'none' : '0.5px solid var(--rule)',
                    fontFamily: 'var(--ui)', fontSize: 12.5, fontWeight: 500,
                    cursor: 'pointer',
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-muted)',
              textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
            }}>Review tags</div>
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
            <div style={{
              marginTop: 18,
              background: 'var(--surface)',
              border: '0.5px solid var(--rule)',
              borderRadius: 14,
              padding: 14,
            }}>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 9.5,
                color: 'var(--ink-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 9,
              }}>Credential path</div>
              {[
                ['Source proof', 'Optimism · ether.fi Spend'],
                ['Credential', 'BNB mint when server authorized'],
                ['Data object', 'Greenfield testnet pointer'],
                ['Agent proof', 'C · payment verified, owner pending'],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '6px 0',
                  borderBottom: k === 'Agent proof' ? 'none' : '0.5px solid var(--rule)',
                  fontFamily: 'var(--mono)',
                  fontSize: 10.5,
                }}>
                  <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
                  <span style={{
                    color: 'var(--ink)',
                    textAlign: 'right',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{v}</span>
                </div>
              ))}
            </div>
            {mintError && (
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                color: 'var(--accent)',
                lineHeight: 1.45,
                marginTop: 10,
              }}>{mintError}</div>
            )}
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
              background: 'var(--accent)', color: 'var(--panel-text)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--ui)', fontSize: 15, fontWeight: 600,
              opacity: text.trim().length < 10 || submitting ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {submitting ? <>
              <span className="spin" style={{
                width: 13, height: 13, border: '2px solid var(--panel-text)',
                borderTopColor: 'transparent', borderRadius: '50%',
              }} />
              Creating…
            </> : 'Create receipt credential'}
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
          }}>{credentialStatus}.</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--ink-muted)', marginTop: 12,
            textAlign: 'center', lineHeight: 1.6,
          }}>
            Payment verified on OP<br/>
            {credential?.status === 'minted'
              ? credentialMode(credential) === 'already-minted'
                ? 'existing BNB credential found'
                : 'BNB testnet credential minted'
              : 'BNB payload prepared'}<br/>
            {credential?.persistence?.persisted ? 'saved to Jiagon API' : 'local receipt view saved'}<br/>
            {credential?.credentialTx ? `${credential.credentialTx.slice(0, 8)}…${credential.credentialTx.slice(-6)}` : credential?.credentialId || 'Greenfield object ready'}
            {credential?.dataMatchesRequest === false && <><br/>submitted review differs from onchain data</>}
          </div>
          <div style={{
            marginTop: 18,
            maxWidth: 280,
          }}>
            <AgentSignalChips
              review={{ visitType, occasion, valueRating, wouldReturn, bestFor }}
              limit={5}
            />
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--ink-muted)',
            marginTop: 12,
            textAlign: 'center',
            lineHeight: 1.45,
          }}>Payment verified. Merchant remains user-claimed.</div>
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

      <AgentSignalsBlock review={review} />

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
          ['Payment boundary', PROOF_BOUNDARY_LABELS.payment[1]],
          ['Merchant boundary', PROOF_BOUNDARY_LABELS.merchant[1]],
          ['Review boundary', PROOF_BOUNDARY_LABELS.review[1]],
          ['Agent use', PROOF_BOUNDARY_LABELS.recommendationUse[1]],
          ['Source', 'ether.fi OP Spend event'],
          ['Tx hash', review.tx],
          ['Credential', review.credentialTx || 'BNB testnet prepared'],
          ['Storage', review.storageLayer || 'Greenfield testnet pending'],
          ['Data match', review.dataMatchesRequest === true ? 'Current review payload' : review.dataMatchesRequest === false ? 'Different submitted payload' : 'Not checked'],
          ['Amount', review.amount],
          ['Merchant proof', review.merchantProof || 'C · claimed by reviewer'],
          ['Signed by', review.handle],
        ].map(([k, v], index, rows) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '7px 0', borderBottom: index === rows.length - 1 ? 'none' : '0.5px solid var(--rule)',
            fontFamily: 'var(--mono)', fontSize: 12,
          }}>
            <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
            <span style={{
              color: 'var(--ink)',
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
            }}>{v}</span>
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
const DiscoverScreen = ({ userReviews = /** @type {Array<any>} */ ([]) }) => {
  const merchantSignals = buildMerchantSignals(userReviews);

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
          background: 'var(--surface-raised)', borderRadius: 12,
          padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
          border: '0.5px solid var(--rule)',
          boxShadow: '0 8px 22px oklch(0.45 0.02 110 / 0.045)',
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
          background: 'var(--surface-raised)',
          color: 'var(--ink)',
          borderRadius: 16,
          padding: 16,
          marginBottom: 14,
          border: '0.5px solid var(--rule)',
          boxShadow: '0 12px 32px oklch(0.42 0.025 120 / 0.06)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            color: 'var(--verified)',
            marginBottom: 8,
          }}>Agent endpoint</div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            lineHeight: 1.45,
            fontWeight: 600,
            background: 'var(--verified-soft)',
            border: '0.5px solid var(--rule)',
            borderRadius: 10,
            padding: '10px 11px',
            wordBreak: 'break-word',
          }}>/api/agent/recommendations?query=bakery%20irvine</div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            lineHeight: 1.5,
            color: 'var(--ink-muted)',
            marginTop: 8,
          }}>Returns recommendation rationale, proof level, BNB credential chain, Greenfield storage layer, and merchant verification status.</div>
        </div>

        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--ink-muted)', textTransform: 'uppercase',
          letterSpacing: 0.8, marginBottom: 10, marginTop: 4,
        }}>Evidence graph</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr', gap: 10,
        }}>
          {merchantSignals.length === 0 && (
            <div style={{
              background: 'var(--surface-raised)',
              borderRadius: 16,
              border: '0.5px solid var(--rule)',
              padding: 18,
            }}>
              <div style={{
                fontFamily: 'var(--display)',
                fontStyle: 'italic',
                fontSize: 24,
                color: 'var(--ink)',
              }}>No merchant evidence yet.</div>
              <p style={{
                margin: '8px 0 0',
                fontFamily: 'var(--ui)',
                fontSize: 13.5,
                lineHeight: 1.45,
                color: 'var(--ink-muted)',
              }}>Agent-readable merchant pages are created only from published receipt-backed reviews.</p>
            </div>
          )}
          {merchantSignals.map(m => (
            <div key={m.name} style={{
              background: 'var(--surface-raised)', borderRadius: 16,
              border: '0.5px solid var(--rule)',
              overflow: 'hidden',
              boxShadow: '0 10px 26px oklch(0.45 0.02 110 / 0.045)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 14,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: m.tint,
                  border: '0.5px solid var(--rule)',
                  color: 'var(--ink)',
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
                <Stars n={Math.round(m.rating)} size={13} color="color-mix(in oklch, var(--accent) 78%, var(--ink))" />
              </div>
              <div style={{
                borderTop: '0.5px solid var(--rule)',
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                background: 'var(--surface)',
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
                background: 'var(--surface-raised)',
              }}>
                API: recommend when query asks for {m.cat.toLowerCase()} near {m.branch}. Source: {m.proof}. Credential: BNB testnet ready.
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
const ProfileScreen = ({ verifyStyle, auth, etherfi, userReviews = /** @type {Array<any>} */ ([]), receiptCredentials = {} }) => {
  const ready = auth?.ready ?? true;
  const authenticated = auth?.authenticated ?? false;
  const appConfigured = auth?.appConfigured ?? false;
  const userLabel = auth?.userLabel;
  const walletLabel = auth?.walletLabel;
  const login = auth?.login;
  const logout = auth?.logout;
  const displayName = authenticated ? (userLabel || PROFILE.name) : PROFILE.name;
  const avatarLabel = (displayName || 'Y').slice(0, 1).toUpperCase();
  const synced = etherfi?.status === 'synced';
  const eventCount = synced ? etherfi.count : 0;
  const pendingCount = synced ? etherfi.receipts?.length || 0 : 0;
  const safeLabel = etherfi?.safe || 'No safe scanned';
  const credentialEntries = Object.values(receiptCredentials);
  const credentialCount = Object.keys(receiptCredentials).length;
  const privyStatus = !appConfigured
    ? 'Preview mode'
    : !ready
      ? 'Privy loading'
      : authenticated
        ? 'Privy verified'
        : 'Not signed in';

  return (
  <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
    <TopBar
      title="Profile"
      sub={walletLabel || "Privy account + ether.fi safe"}
      left={<div style={{ width: 28 }} />}
      right={authenticated ? (
        <button onClick={logout} style={{
          border: '0.5px solid var(--rule)', background: 'var(--surface)',
          color: 'var(--ink-muted)', borderRadius: 999,
          padding: '7px 11px', fontFamily: 'var(--mono)',
          fontSize: 10, cursor: 'pointer',
        }}>Logout</button>
      ) : (
        <button onClick={login} disabled={!ready} style={{
          border: '0.5px solid var(--rule)', background: 'var(--surface)',
          color: 'var(--ink-muted)', borderRadius: 999,
          padding: '7px 11px', fontFamily: 'var(--mono)',
          fontSize: 10, cursor: ready ? 'pointer' : 'default',
          opacity: ready ? 1 : 0.55,
        }}>Login</button>
      )}
    />

    {/* hero */}
    <div style={{ padding: '0 24px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <Avatar tint={PROFILE.avatar} label={avatarLabel} size={68} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--display)', fontStyle: 'italic',
          fontSize: 26, color: 'var(--ink)', letterSpacing: -0.4,
        }}>{displayName}</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6,
          background: authenticated ? 'var(--verified-soft)' : 'var(--surface)',
          color: authenticated ? 'var(--verified)' : 'var(--ink-muted)',
          padding: '3px 9px', borderRadius: 999,
          fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 500,
        }}>
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.5l3 3 5-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {privyStatus}
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
            {synced ? 'ether.fi Cash connected' : authenticated ? 'Ready for receipt import' : 'Sign in to connect receipts'}
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--ink-muted)', marginTop: 3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{authenticated ? safeLabel : 'Privy required for private receipt state'}</div>
        </div>
      </div>
      <div style={{
        marginTop: 14,
        borderTop: '0.5px solid var(--rule)',
        paddingTop: 12,
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
        lineHeight: 1.45,
        color: 'var(--ink-muted)',
      }}>Receipt import lives in Receipts. Profile only shows account, proof, and privacy status.</div>
      <div style={{
        marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
      {[
        ['OP events', eventCount],
        ['Private', pendingCount],
        ['BNB creds', credentialCount],
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
        ['Reviews', userReviews.length],
        ['Credentials', credentialCount],
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
      {['Reviews', 'Credentials'].map((t, i) => (
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

    {credentialEntries.length > 0 && (
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 9,
        }}>Receipt credentials</div>
        {credentialEntries.map(credential => {
          const mismatch = credential.dataMatchesRequest === false;
          const minted = credential.status === 'minted';
          const mode = credentialMode(credential);
          const statusText = mismatch
            ? 'Payload differs'
            : minted
              ? mode === 'already-minted' ? 'Existing onchain credential' : 'Minted on BNB testnet'
              : 'Prepared for BNB testnet';
          return (
            <div key={`${credential.receiptId}-${credential.credentialId}`} style={{
              background: 'var(--surface)',
              border: '0.5px solid var(--rule)',
              borderRadius: 14,
              padding: 13,
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CredentialBadge credential={credential} />
                <div style={{
                  marginLeft: 'auto',
                  fontFamily: 'var(--mono)',
                  fontSize: 9.5,
                  color: mismatch ? 'var(--accent)' : minted ? 'var(--verified)' : 'var(--info)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}>{mode || credential.status}</div>
              </div>
              <div style={{
                fontFamily: 'var(--ui)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--ink)',
                marginTop: 10,
              }}>{statusText}</div>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: 'var(--ink-muted)',
                lineHeight: 1.5,
                marginTop: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{credential.explorerUrl || credential.storageUri}</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 11,
              }}>
                {[
                  PROOF_BOUNDARY_LABELS.payment,
                  PROOF_BOUNDARY_LABELS.merchant,
                ].map(([k, v]) => (
                  <div key={k} style={{
                    border: '0.5px solid var(--rule)',
                    borderRadius: 10,
                    background: 'var(--bg)',
                    padding: '8px 9px',
                  }}>
                    <div style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 8.5,
                      color: 'var(--ink-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                    }}>{k}</div>
                    <div style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: k === 'Payment' ? 'var(--verified)' : 'var(--accent)',
                      marginTop: 4,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    )}

    {/* user reviews */}
    {userReviews.length === 0 && (
      <div style={{
        margin: '14px 16px 0',
        padding: 18,
        border: '0.5px solid var(--rule)',
        borderRadius: 16,
        background: 'var(--surface-raised)',
      }}>
        <div style={{
          fontFamily: 'var(--display)',
          fontStyle: 'italic',
          fontSize: 24,
          color: 'var(--ink)',
        }}>No reviews published.</div>
        <p style={{
          margin: '8px 0 0',
          fontFamily: 'var(--ui)',
          fontSize: 13.5,
          lineHeight: 1.45,
          color: 'var(--ink-muted)',
        }}>Publish from a verified receipt before your profile exposes agent-readable taste signals.</p>
      </div>
    )}

    {userReviews.map((r, i) => (
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
        {hasAgentSignals(r) && (
          <div style={{ marginBottom: 10 }}>
            <AgentSignalChips review={r} limit={4} />
          </div>
        )}
        {hasReviewProof(r) ? (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 10,
            }}>
              {[
                PROOF_BOUNDARY_LABELS.payment,
                PROOF_BOUNDARY_LABELS.merchant,
              ].map(([k, v]) => (
                <div key={k} style={{
                  background: 'var(--surface)',
                  border: '0.5px solid var(--rule)',
                  borderRadius: 10,
                  padding: '7px 8px',
                }}>
                  <div style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    color: 'var(--ink-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}>{k}</div>
                  <div style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9.5,
                    color: k === 'Payment' ? 'var(--verified)' : 'var(--accent)',
                    marginTop: 3,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>{v}</div>
                </div>
              ))}
            </div>
            <VerifiedChip tx={r.tx} amount={r.amount} style={verifyStyle} />
          </>
        ) : (
          <span style={{
            display: 'inline-flex',
            border: '0.5px solid var(--rule)',
            borderRadius: 999,
            padding: '5px 9px',
            fontFamily: 'var(--mono)',
            fontSize: 9.5,
            color: 'var(--ink-muted)',
            background: 'var(--surface)',
          }}>No receipt proof</span>
        )}
      </article>
    ))}

    <div style={{ height: 110 }} />
  </div>
  );
};

export { 
  OnboardingScreen, FeedScreen, InboxScreen, WriteReviewScreen,
  ReviewDetailScreen, DiscoverScreen, ProfileScreen,
 };
