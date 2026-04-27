"use client";
import React from "react";

// Jiagon — on-chain verified review app
// Main app: nav, state, screens

// Note: hooks accessed via React.useState etc to avoid scope collisions across babel scripts

// ─────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────
const ETHERFI_SYNC = {
  provider: 'ether.fi Cash',
  auth: 'Privy',
  wallet: '0x3e9a…a04f',
  safe: '0x8745…9d0b',
  safeFull: '0x874525d36afad840ac44e5d66e62f18f49439d0b',
  chain: 'Optimism',
  emitter: '0x380b…1acb',
  detected: 73,
  pending: 4,
  reviewed: 18,
  totalSpend: '$4,240.68',
  lastSync: '2m ago',
};

const RECEIPTS = [
  {
    id: 'r1',
    provider: 'ether.fi',
    merchant: '85C Bakery Cafe',
    branch: 'Irvine',
    cat: 'Bakery · Irvine',
    glyph: '8',
    tint: 'var(--place-warm)',
    amount: '$4.95',
    token: 'OP USDC',
    date: 'Apr 25 · 12:16',
    tx: '0x61b4…d63',
    txFull: '0x61b4fc8c1231718095587404fe8095e0b171bbf153eb608ea3fe7d4dde2e2d63',
    block: 150772910,
    proof: 'OP Spend event',
    status: 'claimed',
    reviewed: false,
  },
  {
    id: 'r2',
    provider: 'ether.fi',
    merchant: null,
    branch: null,
    cat: 'Merchant not claimed',
    glyph: '$',
    tint: 'var(--place-paper)',
    amount: '$30.40',
    token: 'OP USDC',
    date: 'Apr 25 · 00:56',
    tx: '0xe0dc…bf4a',
    txFull: '0xe0dc1a1747f347876f52f26123c74b09d2b949b51dcd7f7c4cf2ac2f5b3bf4a3',
    block: 150739910,
    proof: 'OP Spend event',
    status: 'unclaimed',
    reviewed: false,
  },
  {
    id: 'r3',
    provider: 'ether.fi',
    merchant: null,
    branch: null,
    cat: 'Merchant not claimed',
    glyph: '$',
    tint: 'var(--place-paper)',
    amount: '$14.25',
    token: 'OP USDC',
    date: 'Apr 24 · 07:27',
    tx: '0x2b85…9316',
    txFull: '0x2b85dff9aadecb5e3548dc71414712cd8ed521ddb227973f09f10490637c9316',
    block: 150708446,
    proof: 'OP Spend event',
    status: 'unclaimed',
    reviewed: false,
  },
  {
    id: 'r4',
    provider: 'ether.fi',
    merchant: 'Tartine',
    branch: 'San Francisco',
    cat: 'Bakery · SF',
    glyph: '◐',
    tint: 'var(--place-warm)',
    amount: '$21.54',
    token: 'OP USDC',
    date: 'Apr 24 · 19:11',
    tx: '0xf82b…0158',
    txFull: '0xf82bd2c90ca27293490bc8b2b36daff4b91ba2b593301580c3c308764d3b0158',
    block: 150729542,
    proof: 'OP Spend event',
    status: 'reviewed',
    reviewed: true,
  },
  {
    id: 'r5',
    provider: 'ether.fi',
    merchant: 'Fuglen Coffee',
    branch: 'Tokyo',
    cat: 'Café · Tokyo',
    glyph: '☕',
    tint: 'var(--place-fresh)',
    amount: '$7.00',
    token: 'OP USDC',
    date: 'Apr 24 · 20:35',
    tx: '0xdb3c…8d9b',
    txFull: '0xdb3ccba12a650786bf2ebe9365cf60b69e5a1d514f981fac1984bc3145168d9b',
    block: 150732075,
    proof: 'OP Spend event',
    status: 'reviewed',
    reviewed: true,
  },
];

const FEED = [
  {
    id: 'f1', author: 'mira.eth', handle: '0x8a2…f01',
    rep: 412, avatar: 'var(--avatar-warm)',
    merchant: '85C Bakery Cafe', branch: 'Irvine', cat: 'Bakery · Irvine',
    rating: 5, time: '2h',
    text: 'Fast pastry stop before a drive. The sea salt coffee was consistent and the line moved in under five minutes.',
    tx: '0x61b4…d63', amount: '$4.95 OP USDC',
    proofLevel: 'A · onchain payment',
    merchantProof: 'C · claimed merchant',
    verifiedVisits: 12,
    photo: 'var(--place-warm)',
  },
  {
    id: 'f2', author: 'kenji.lens', handle: '0x4f1…22d',
    rep: 1280, avatar: 'var(--avatar-cool)',
    merchant: 'Tartine', branch: 'San Francisco', cat: 'Bakery · SF',
    rating: 4, time: '6h',
    text: 'Morning bun still hits. Crowded, but this visit was quick enough to recommend for pickup, not a sit-down.',
    tx: '0xf82b…0158', amount: '$21.54 OP USDC',
    proofLevel: 'A · onchain payment',
    merchantProof: 'C · claimed merchant',
    verifiedVisits: 8,
    photo: null,
  },
  {
    id: 'f3', author: 'luca.pay', handle: '0x21c…9e8',
    rep: 87, avatar: 'var(--avatar-fresh)',
    merchant: 'Fuglen Coffee', branch: 'Tokyo', cat: 'Café · Tokyo',
    rating: 5, time: '1d',
    text: 'The hand-drip Ethiopia was clean and bright. Worth routing here if the agent is optimizing for quiet coffee.',
    tx: '0xdb3c…8d9b', amount: '$7.00 OP USDC',
    proofLevel: 'A · onchain payment',
    merchantProof: 'C · claimed merchant',
    verifiedVisits: 5,
    photo: 'var(--place-fresh)',
  },
];

const MERCHANTS = [
  {
    id: 'm1',
    name: '85C Bakery Cafe',
    branch: 'Irvine',
    cat: 'Bakery',
    tint: 'var(--place-warm)',
    glyph: '8',
    rating: 4.5,
    visits: 12,
    wallets: 7,
    spend: '$59.40',
    lastVisit: 'Today',
    proof: 'ether.fi OP spend events',
  },
  {
    id: 'm2',
    name: 'Tartine',
    branch: 'San Francisco',
    cat: 'Bakery',
    tint: 'var(--place-warm)',
    glyph: '◐',
    rating: 4.2,
    visits: 8,
    wallets: 6,
    spend: '$171.12',
    lastVisit: '2d ago',
    proof: 'ether.fi OP spend events',
  },
  {
    id: 'm3',
    name: 'Fuglen Coffee',
    branch: 'Tokyo',
    cat: 'Café',
    tint: 'var(--place-cool)',
    glyph: '☕',
    rating: 4.8,
    visits: 5,
    wallets: 4,
    spend: '$41.84',
    lastVisit: '3d ago',
    proof: 'ether.fi OP spend events',
  },
];

const PROFILE = {
  name: 'you.eth',
  handle: '0x3e9…a04',
  rep: 246,
  reviews: 18,
  receipts: 73,
  joined: 'Mar 2025',
  avatar: 'var(--avatar-warm)',
};

// ─────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────
const Stars = ({ n, size = 13, color }) => (
  <div style={{ display: 'inline-flex', gap: 1.5 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{
        fontSize: size, lineHeight: 1,
        color: i <= n ? (color || 'var(--accent)') : 'var(--rule)',
      }}>★</span>
    ))}
  </div>
);

const VerifiedChip = ({ tx, amount, style: vStyle = 'chip' }) => {
  if (vStyle === 'stamp') {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: '1.5px solid var(--verified)',
        color: 'var(--verified)',
        padding: '3px 8px 3px 6px', borderRadius: 4,
        fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
        letterSpacing: 0.6, textTransform: 'uppercase',
        transform: 'rotate(-2deg)',
      }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5l3 3 5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        On-chain · {amount}
      </div>
    );
  }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--verified-soft)', color: 'var(--verified)',
      padding: '3px 8px 3px 6px', borderRadius: 999,
      fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 500,
      letterSpacing: 0.1,
    }}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5.5" fill="var(--verified)"/>
        <path d="M3.2 6.2l1.8 1.8 3.8-4.4" stroke="var(--panel-text)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
      <span>A payment · {amount}</span>
      {tx && <span style={{ opacity: 0.6 }}>· {tx}</span>}
    </div>
  );
};

const Avatar = ({ tint, label, size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: tint, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--mono)', fontSize: size * 0.36,
    color: 'var(--ink)', fontWeight: 500,
    boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08)',
  }}>{label}</div>
);

// Hatch placeholder for imagery
const Hatched = ({ tint, label, height = 180, radius = 14 }) => (
  <div style={{
    height, borderRadius: radius, background: tint,
    position: 'relative', overflow: 'hidden',
    boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.08)',
  }}>
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 9px)',
    }} />
    <div style={{
      position: 'absolute', bottom: 8, left: 10,
      fontFamily: 'var(--mono)', fontSize: 9.5, color: 'rgba(0,0,0,0.4)',
      textTransform: 'uppercase', letterSpacing: 0.6,
    }}>{label}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Top bar (custom — replaces IOSNavBar)
// ─────────────────────────────────────────────────────────────
const TopBar = ({ title, left, right, big = true, sub }) => (
  <div style={{
    paddingTop: 56, paddingBottom: big ? 12 : 10,
    background: 'var(--bg)',
    position: 'sticky', top: 0, zIndex: 10,
    borderBottom: big ? 'none' : '0.5px solid var(--rule)',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 18px 4px', minHeight: 32,
    }}>
      <div style={{ minWidth: 44 }}>{left}</div>
      {!big && (
        <div style={{
          fontFamily: 'var(--ui)', fontSize: 16, fontWeight: 600, color: 'var(--ink)',
        }}>{title}</div>
      )}
      <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>{right}</div>
    </div>
    {big && (
      <div style={{ padding: '4px 20px 0' }}>
        <div style={{
          fontFamily: 'var(--display)', fontSize: 38, lineHeight: 1.02,
          color: 'var(--ink)', letterSpacing: -0.5, fontWeight: 400,
          fontStyle: 'italic',
        }}>{title}</div>
        {sub && <div style={{
          fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-muted)',
          textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4,
        }}>{sub}</div>}
      </div>
    )}
  </div>
);

const IconBtn = ({ children, onClick }) => (
  <button onClick={onClick} style={{
    width: 36, height: 36, borderRadius: '50%',
    background: 'var(--surface)', border: '0.5px solid var(--rule)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0, color: 'var(--ink)',
  }}>{children}</button>
);

// ─────────────────────────────────────────────────────────────
// Tab bar
// ─────────────────────────────────────────────────────────────
const TabBar = ({ active, onChange }) => {
  const tabs = [
    { id: 'feed', label: 'Memory', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 7h18M3 12h18M3 17h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'inbox', label: 'Receipts', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'discover', label: 'Agent', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    )},
    { id: 'profile', label: 'Profile', icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    )},
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 28, paddingTop: 8,
      background: 'var(--bg-blur)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '0.5px solid var(--rule)',
      display: 'flex', justifyContent: 'space-around',
      zIndex: 20,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          color: active === t.id ? 'var(--accent)' : 'var(--ink-muted)',
          padding: '4px 12px',
        }}>
          {t.icon}
          <span style={{
            fontFamily: 'var(--ui)', fontSize: 10, fontWeight: 500,
            letterSpacing: 0.2,
          }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
};

export { 
  RECEIPTS, FEED, PROFILE, ETHERFI_SYNC, MERCHANTS,
  Stars, VerifiedChip, Avatar, Hatched, TopBar, IconBtn, TabBar,
 };
