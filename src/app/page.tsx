"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function IntroPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const seen = sessionStorage.getItem("mis_intro_seen");
    if (seen) { router.replace("/login"); return; }
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [router]);

  function goToLogin() {
    if (skipping) return;
    setSkipping(true);
    sessionStorage.setItem("mis_intro_seen", "1");
    router.replace("/login");
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black cursor-pointer"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.8s ease" }}
      onClick={goToLogin}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={isMobile ? "/videos/intro-mobile.mp4" : "/videos/intro-desktop.mp4"}
        autoPlay
        muted
        playsInline
        onEnded={goToLogin}
      />
    </div>
  );
}
