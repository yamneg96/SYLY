// Motion helpers (framer-motion). Everything here is decoration: it never hides content from keyboard or screen
// reader users, and it switches off when the person asks for less motion.
import type { ReactNode } from "react"
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"

/** Fades and lifts its content into view the first time it is scrolled to. `delay` staggers siblings. */
export function Reveal({ children, delay = 0, y = 28, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.65, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** A thin amber line under the header that fills as the page is read. */
export function ScrollProgress() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 })
  if (reduce) return null
  return <motion.div aria-hidden="true" style={{ scaleX }} className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[3px] origin-left bg-gradient-to-r from-[#F5A300] via-[#FFD27A] to-[#5BA4FF]" />
}

/** Moves its (decorative) children slower than the page, for depth in the hero. */
export function Parallax({ children, distance = 80, className }: { children: ReactNode; distance?: number; className?: string }) {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 600], [0, distance])
  return (
    <motion.div aria-hidden="true" style={reduce ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  )
}
