import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    const options: ScrollToOptions = { top: 0, behavior: "smooth" };
    window.scrollTo(options);
    document.documentElement?.scrollTo(options);
    document.body?.scrollTo(options);
  };

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 18, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.92 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-sky-300/18 bg-[linear-gradient(135deg,rgba(59,130,246,0.92),rgba(30,64,175,0.96))] text-white shadow-[0_18px_40px_rgba(30,64,175,0.34)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(30,64,175,0.38)]"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
