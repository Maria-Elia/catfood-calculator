// Animates <details class="faq__item"> open/close via the Web Animations API

const DURATION = 220;
const EASING = "cubic-bezier(0.23, 1, 0.32, 1)";

class AnimatedFaqItem {
  constructor(details) {
    this.details = details;
    this.summary = details.querySelector("summary");
    this.content = details.querySelector(".faq__item-content");
    this.animation = null;
    this.rafId = null;
    this.isClosing = false;
    this.isExpanding = false;
    this.summary.addEventListener("click", (event) => this.onClick(event));
  }

  onClick(event) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    this.details.style.overflow = "hidden";
    // open() schedules expand() one frame later. A second click before that
    // frame fires must cancel it, otherwise the stale expand() runs after
    // shrink() has already taken over and stomps on its animation.
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.isClosing || !this.details.open) {
      this.open();
    } else if (this.isExpanding || this.details.open) {
      this.shrink();
    }
  }

  ownBoxExtra() {
    const cs = window.getComputedStyle(this.details);
    return (
      parseFloat(cs.paddingTop) +
      parseFloat(cs.paddingBottom) +
      parseFloat(cs.borderTopWidth) +
      parseFloat(cs.borderBottomWidth)
    );
  }

  shrink() {
    this.isClosing = true;
    const startHeight = `${this.details.offsetHeight}px`;
    const endHeight = `${this.summary.offsetHeight + this.ownBoxExtra()}px`;
    this.animation?.cancel();
    this.animation = this.details.animate(
      { height: [startHeight, endHeight] },
      { duration: DURATION, easing: EASING, fill: "forwards" },
    );
    this.animation.onfinish = () => this.onAnimationFinish(false);
    this.animation.oncancel = () => {
      this.isClosing = false;
    };
  }

  open() {
    // Read the current visual height before
    // canceling any running animation, so pinning it doesn't cause a jump.
    const currentHeight = `${this.details.offsetHeight}px`;
    this.animation?.cancel();
    this.details.style.height = currentHeight;
    this.details.open = true;
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null;
      this.expand();
    });
  }

  expand() {
    this.isExpanding = true;
    const startHeight = `${this.details.offsetHeight}px`;
    const endHeight = `${this.summary.offsetHeight + this.content.offsetHeight + this.ownBoxExtra()}px`;
    this.animation?.cancel();
    this.animation = this.details.animate(
      { height: [startHeight, endHeight] },
      { duration: DURATION, easing: EASING, fill: "forwards" },
    );
    this.animation.onfinish = () => this.onAnimationFinish(true);
    this.animation.oncancel = () => {
      this.isExpanding = false;
    };
  }

  onAnimationFinish(open) {
    this.details.open = open;
    this.animation = null;
    this.isClosing = false;
    this.isExpanding = false;
    this.details.style.height = "";
    this.details.style.overflow = "";
  }
}

export function initFaqAccordion() {
  if (typeof HTMLElement === "undefined" || !HTMLElement.prototype.animate) return;
  document.querySelectorAll(".faq__item").forEach((details) => new AnimatedFaqItem(details));
}
