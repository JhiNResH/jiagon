"use client";

import { useState, useEffect, useRef } from "react";
import { IOSDevice } from "@/components/IOSFrame";
import { TabBar } from "@/components/AppData";
import {
  OnboardingScreen, FeedScreen, InboxScreen, WriteReviewScreen,
  ReviewDetailScreen, DiscoverScreen, ProfileScreen,
} from "@/components/screens";

type Tab = "feed" | "inbox" | "discover" | "profile";
type VerifyStyle = "chip" | "stamp";
type Density = "compact" | "comfy";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("feed");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewing, setReviewing] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detail, setDetail] = useState<any>(null);
  const [showOnboard, setShowOnboard] = useState(true);
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const verifyStyle: VerifyStyle = "chip";
  const density: Density = "comfy";
  const dark = false;

  // Apply theme + accent
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  // Fit device to viewport
  useEffect(() => {
    const fit = () => {
      const W = window.innerWidth - 60;
      const H = window.innerHeight - 60;
      const dw = 402, dh = 874;
      const s = Math.min(W / dw, H / dh, 1.05);
      setScale(s);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const tabContent: Record<Tab, React.ReactNode> = {
    feed: <FeedScreen onOpenReview={(r: unknown) => setDetail(r)} density={density} verifyStyle={verifyStyle} />,
    inbox: <InboxScreen onOpenReceipt={(r: unknown) => setReviewing(r)} />,
    discover: <DiscoverScreen />,
    profile: <ProfileScreen verifyStyle={verifyStyle} />,
  };

  return (
    <>
      <div className="label">
        <span className="accent">●</span>&nbsp;&nbsp;JIAGON · ETHER.FI RECEIPT MVP · v0.1
      </div>

      <div className="stage" ref={stageRef} suppressHydrationWarning>
        {mounted && (
        <div className="device-shell" style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <IOSDevice width={402} height={874} dark={dark}>
            <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0 }}>
                {tabContent[tab]}
                <TabBar active={tab} onChange={setTab} />
              </div>

              {detail && (
                <div className="screen modal-enter" style={{ zIndex: 30 }}>
                  <ReviewDetailScreen review={detail} onClose={() => setDetail(null)} verifyStyle={verifyStyle} />
                </div>
              )}

              {reviewing && (
                <div className="screen modal-enter" style={{ zIndex: 40 }}>
                  <WriteReviewScreen receipt={reviewing} onClose={() => setReviewing(null)} onSubmit={() => setReviewing(null)} />
                </div>
              )}

              {showOnboard && (
                <div className="screen" style={{ zIndex: 50 }}>
                  <OnboardingScreen onDone={() => { setShowOnboard(false); setTab("inbox"); }} />
                </div>
              )}
            </div>
          </IOSDevice>
        </div>
        )}
      </div>
    </>
  );
}
