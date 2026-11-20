"use client";

import { forwardRef, useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./button.module.css";

type ButtonVariant = "hud" | "ghost";
type ButtonSize = "sm" | "md";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ active = false, children, className, onMouseDown, onMouseEnter, onMouseLeave, onMouseUp, size = "sm", variant = "hud", ...props }, ref) => {
    const localRef = useRef<HTMLButtonElement | null>(null);

    const setRefs = (node: HTMLButtonElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    useEffect(() => {
      const node = localRef.current;
      if (!node) return undefined;

      gsap.to(node, {
        borderColor: active ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.28)",
        boxShadow: active
          ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 0 20px rgba(255, 255, 255, 0.08)"
          : "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)",
        duration: 0.28,
        ease: "power2.out",
      });

      return () => {
        gsap.killTweensOf(node);
      };
    }, [active]);

    const handleEnter: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (!props.disabled) {
        gsap.to(event.currentTarget, {
          y: -1,
          scale: 1.025,
          filter: "brightness(1.15)",
          duration: 0.22,
          ease: "power2.out",
        });
      }
      onMouseEnter?.(event);
    };

    const handleLeave: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      gsap.to(event.currentTarget, {
        y: 0,
        scale: 1,
        filter: "brightness(1)",
        duration: 0.24,
        ease: "power2.out",
      });
      onMouseLeave?.(event);
    };

    const handleDown: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (!props.disabled) {
        gsap.to(event.currentTarget, {
          y: 1,
          scale: 0.97,
          duration: 0.1,
          ease: "power2.out",
        });
      }
      onMouseDown?.(event);
    };

    const handleUp: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (!props.disabled) {
        gsap.to(event.currentTarget, {
          y: -1,
          scale: 1.025,
          duration: 0.16,
          ease: "power2.out",
        });
      }
      onMouseUp?.(event);
    };

    return (
      <button
        ref={setRefs}
        className={joinClasses(styles.button, styles[size], variant === "ghost" && styles.ghost, active && styles.active, className)}
        onMouseDown={handleDown}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onMouseUp={handleUp}
        type="button"
        {...props}
      >
        <span className={styles.content}>{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";
