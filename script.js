// --- Infra Carousel Auto-Focus & Loop ---
document.addEventListener('DOMContentLoaded', function() {
    // --- Hero Block Rotator ---
    (function initHeroBlockRotator(){
        const rotator = document.getElementById('hero-rotator');
        if (!rotator) return;
        const blocks = Array.from(rotator.querySelectorAll('.rot-block'));
        if (blocks.length <= 1) return;
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let idx = blocks.findIndex(b => b.classList.contains('is-active'));
        if (idx < 0) idx = 0;
        let timer = null;
    const visibleMs = 3600; // slower cycle so quotes stay longer
    const animMs = prefersReduced ? 0 : 460; // keep in sync with CSS

        // Set initial height to current active block to avoid layout jump
        function syncHeight(el) {
            // Use scrollHeight for stability and add a small buffer for descenders
            const h = el.scrollHeight;
            rotator.style.height = (h + 4) + 'px';
        }
        syncHeight(blocks[idx]);

        function setActive(nextIdx){
            const current = blocks[idx];
            const next = blocks[nextIdx];
            if (current === next) return;
            // mark current as leaving
            current.classList.remove('is-active');
            if (animMs) current.classList.add('is-leaving');
            current.setAttribute('aria-hidden', 'true');
            // prepare next
            next.classList.add('is-active');
            next.classList.remove('is-leaving');
            next.setAttribute('aria-hidden', 'false');
            // update container height smoothly
            syncHeight(next);
            // cleanup leaving state after animation
            if (animMs) setTimeout(() => current.classList.remove('is-leaving'), animMs + 40);
            else current.classList.remove('is-leaving');
            idx = nextIdx;
        }

        function cycle(){
            clearTimeout(timer);
            const nextIdx = (idx + 1) % blocks.length;
            setActive(nextIdx);
            timer = setTimeout(cycle, visibleMs + animMs);
        }

        // Start quickly for immediate feedback
    timer = setTimeout(cycle, 700);

        // Pause/resume on interaction
        let paused = false;
        function pause(){ if (!paused){ paused = true; clearTimeout(timer);} }
        function resume(){ if (paused){ paused = false; timer = setTimeout(cycle, visibleMs);} }
        rotator.addEventListener('mouseenter', pause);
        rotator.addEventListener('mouseleave', resume);
        rotator.addEventListener('focusin', pause);
        rotator.addEventListener('focusout', (e)=>{ if (!rotator.contains(e.relatedTarget)) resume(); });
    })();

    const infraTrack = document.querySelector('.infra-carousel-track');
    const infraCards = infraTrack ? infraTrack.querySelectorAll('.infra-card') : [];
    let focusIndex = 0;
    let autoFocusInterval = null;
    let isPaused = false;
    let resumeTimeout = null;

    function setFocus(idx, opts = {}) {
        const doScroll = opts.scroll !== false; // default true
        infraCards.forEach((card, i) => {
            if (i === idx) {
                card.classList.add('infra-card-focus');
                if (doScroll) {
                    const infraSection = document.querySelector('.infrastructure');
                    if (infraSection) {
                        const rect = infraSection.getBoundingClientRect();
                        const inView = rect.top < window.innerHeight && rect.bottom > 0;
                        const dragging = infraTrack && infraTrack.classList.contains('dragging');
                        if (inView && infraTrack && !dragging) {
                            const trackRect = infraTrack.getBoundingClientRect();
                            const cardRect = card.getBoundingClientRect();
                            const delta = (cardRect.left + cardRect.right) / 2 - (trackRect.left + trackRect.right) / 2;
                            // compute proposed target scrollLeft
                            let target = infraTrack.scrollLeft + delta;
                            // clamp to ensure first/last cards are not clipped
                            const styles = getComputedStyle(infraTrack);
                            const padLeft = parseFloat(styles.paddingLeft) || 0;
                            const padRight = parseFloat(styles.paddingRight) || 0;
                            // safe margin to account for scale(1.08) overflow
                            const safe = 24;
                            const maxScroll = infraTrack.scrollWidth - infraTrack.clientWidth;
                            const minTarget = 0 - padLeft - safe;
                            const maxTarget = maxScroll + padRight + safe;
                            target = Math.max(minTarget, Math.min(maxTarget, target));
                            const by = target - infraTrack.scrollLeft;
                            infraTrack.scrollBy({ left: by, behavior: 'smooth' });
                        }
                    }
                }
            } else {
                card.classList.remove('infra-card-focus');
            }
        });
        focusIndex = idx;
    }

    function startAutoFocus() {
        if (autoFocusInterval) clearInterval(autoFocusInterval);
        autoFocusInterval = setInterval(() => {
            const infraSection = document.querySelector('.infrastructure');
            const rect = infraSection ? infraSection.getBoundingClientRect() : null;
            const inView = rect && rect.top < window.innerHeight && rect.bottom > 0;
            if (!isPaused && inView && infraCards.length) {
                const nextIdx = (focusIndex + 1) % infraCards.length;
                setFocus(nextIdx, { scroll: true });
            }
        }, 1600);
    }

    // Initial focus without scrolling to avoid nudging the track under the pointer
    setFocus(focusIndex, { scroll: false });

    // Start/pause when the section enters/leaves viewport
    let hasStartedOnView = false;
    const infraSectionEl = document.querySelector('.infrastructure');
    if (infraSectionEl) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    isPaused = false;
                    if (!autoFocusInterval) startAutoFocus();
                    // Nudge once immediately so animation is visible right away
                    if (!hasStartedOnView && infraCards.length) {
                        hasStartedOnView = true;
                        setTimeout(() => setFocus((focusIndex + 1) % infraCards.length, { scroll: true }), 150);
                    }
                } else {
                    isPaused = true;
                }
            });
        }, { threshold: 0.15 });
        io.observe(infraSectionEl);
    }
    // Pause autoplay when hovering anywhere over the track; resume when leaving the track
    if (infraTrack) {
        infraTrack.addEventListener('mouseenter', () => {
            isPaused = true;
            if (autoFocusInterval) {
                clearInterval(autoFocusInterval);
                autoFocusInterval = null;
            }
        });
        infraTrack.addEventListener('mouseleave', () => {
            isPaused = false;
            startAutoFocus();
        });
        // Accessibility: pause while focus is within the track, resume when focus leaves track
        infraTrack.addEventListener('focusin', () => { isPaused = true; });
        infraTrack.addEventListener('focusout', (e) => {
            // Only resume if focus has moved completely outside the track
            const next = e.relatedTarget;
            if (!next || !infraTrack.contains(next)) {
                isPaused = false;
                startAutoFocus();
            }
        });
    }

    // Card-level hover: focus the hovered card without scrolling; do not resume autoplay
    infraCards.forEach((card, idx) => {
        card.addEventListener('mouseenter', function() {
            isPaused = true;
            setFocus(idx, { scroll: false });
        });
        card.addEventListener('mouseleave', function(e) {
            // If leaving to another element inside the track, stay paused
            if (infraTrack && e.relatedTarget && infraTrack.contains(e.relatedTarget)) {
                return;
            }
            // Otherwise, resumption is handled by track mouseleave/focusout
        });
    });

    // Arrow navigation
    const prevBtn = document.querySelector('.infra-prev');
    const nextBtn = document.querySelector('.infra-next');

    function pauseAndResumeLater() {
        isPaused = true;
        if (autoFocusInterval) { clearInterval(autoFocusInterval); autoFocusInterval = null; }
        if (resumeTimeout) clearTimeout(resumeTimeout);
        resumeTimeout = setTimeout(() => {
            isPaused = false;
            startAutoFocus();
        }, 2500);
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            pauseAndResumeLater();
            if (!infraCards.length) return;
            const idx = (focusIndex - 1 + infraCards.length) % infraCards.length;
            setFocus(idx, { scroll: true });
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            pauseAndResumeLater();
            if (!infraCards.length) return;
            const idx = (focusIndex + 1) % infraCards.length;
            setFocus(idx, { scroll: true });
        });
    }
});

// Shared reveal-on-scroll observer used by animation initializers below
let observer;
try {
    observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
} catch (e) {
    observer = null;
}

// --- Continuous marquee for Automobile Products scroller ---
document.addEventListener('DOMContentLoaded', function () {
    const track = document.querySelector('#automobile-products .product-scroll');
    if (!track) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const items = Array.from(track.children);
    if (items.length === 0) return;

    const originalWidth = track.scrollWidth;
    const overflow = originalWidth > track.clientWidth + 4;
    if (!overflow || items.length < 4) return;
    items.forEach(node => track.appendChild(node.cloneNode(true)));
    let loopWidth = originalWidth;

    track.classList.add('marquee-active');

    let paused = false;
    let userInteracting = false;
    let inView = false;
    let last = performance.now();
    let pxPerSec = 40;

    const onFrame = (now) => {
        const dt = now - last;
        last = now;
        if (!paused && !userInteracting && inView) {
            const delta = (pxPerSec * dt) / 1000;
            track.scrollLeft += delta;
            if (track.scrollLeft >= loopWidth) {
                track.scrollLeft -= loopWidth;
            }
        }
        requestAnimationFrame(onFrame);
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => { inView = entry.isIntersecting; });
    }, { threshold: 0.2 });
    io.observe(track);

    track.addEventListener('mouseenter', () => paused = true);
    track.addEventListener('mouseleave', () => paused = false);
    track.addEventListener('focusin', () => paused = true);
    track.addEventListener('focusout', () => paused = false);

    const markInteract = () => { userInteracting = true; };
    const unmarkInteract = () => { setTimeout(() => userInteracting = false, 300); };
    track.addEventListener('mousedown', markInteract);
    window.addEventListener('mouseup', unmarkInteract);
    track.addEventListener('touchstart', markInteract, { passive: true });
    window.addEventListener('touchend', unmarkInteract, { passive: true });

    window.addEventListener('resize', () => {
        const firstHalfWidth = items.reduce((w, el) => w + el.getBoundingClientRect().width, 0);
        const styles = getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        loopWidth = firstHalfWidth + gap * (items.length - 1);
    });

    requestAnimationFrame(onFrame);
});

// --- Continuous marquee for Tube Products scroller ---
document.addEventListener('DOMContentLoaded', function () {
    const track = document.querySelector('#tube-products .product-scroll');
    if (!track) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const items = Array.from(track.children);
    if (items.length === 0) return;

    const originalWidth = track.scrollWidth;
    const overflow = originalWidth > track.clientWidth + 4;
    if (!overflow || items.length < 4) return;
    items.forEach(node => track.appendChild(node.cloneNode(true)));
    let loopWidth = originalWidth;

    track.classList.add('marquee-active');

    let paused = false;
    let userInteracting = false;
    let inView = false;
    let last = performance.now();
    let pxPerSec = 40;

    const onFrame = (now) => {
        const dt = now - last;
        last = now;
        if (!paused && !userInteracting && inView) {
            const delta = (pxPerSec * dt) / 1000;
            track.scrollLeft += delta;
            if (track.scrollLeft >= loopWidth) {
                track.scrollLeft -= loopWidth;
            }
        }
        requestAnimationFrame(onFrame);
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => { inView = entry.isIntersecting; });
    }, { threshold: 0.2 });
    io.observe(track);

    track.addEventListener('mouseenter', () => paused = true);
    track.addEventListener('mouseleave', () => paused = false);
    track.addEventListener('focusin', () => paused = true);
    track.addEventListener('focusout', () => paused = false);

    const markInteract = () => { userInteracting = true; };
    const unmarkInteract = () => { setTimeout(() => userInteracting = false, 300); };
    track.addEventListener('mousedown', markInteract);
    window.addEventListener('mouseup', unmarkInteract);
    track.addEventListener('touchstart', markInteract, { passive: true });
    window.addEventListener('touchend', unmarkInteract, { passive: true });

    window.addEventListener('resize', () => {
        const firstHalfWidth = items.reduce((w, el) => w + el.getBoundingClientRect().width, 0);
        const styles = getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        loopWidth = firstHalfWidth + gap * (items.length - 1);
    });

    requestAnimationFrame(onFrame);
});

// --- Continuous marquee for Bus Products scroller ---
document.addEventListener('DOMContentLoaded', function () {
    const track = document.querySelector('#bus-products .product-scroll');
    if (!track) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const items = Array.from(track.children);
    if (items.length === 0) return;

    const originalWidth = track.scrollWidth;
    const overflow = originalWidth > track.clientWidth + 4;
    if (!overflow || items.length < 4) return;
    items.forEach(node => track.appendChild(node.cloneNode(true)));
    let loopWidth = originalWidth;

    track.classList.add('marquee-active');

    let paused = false;
    let userInteracting = false;
    let inView = false;
    let last = performance.now();
    let pxPerSec = 40;

    const onFrame = (now) => {
        const dt = now - last;
        last = now;
        if (!paused && !userInteracting && inView) {
            const delta = (pxPerSec * dt) / 1000;
            track.scrollLeft += delta;
            if (track.scrollLeft >= loopWidth) {
                track.scrollLeft -= loopWidth;
            }
        }
        requestAnimationFrame(onFrame);
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => { inView = entry.isIntersecting; });
    }, { threshold: 0.2 });
    io.observe(track);

    track.addEventListener('mouseenter', () => paused = true);
    track.addEventListener('mouseleave', () => paused = false);
    track.addEventListener('focusin', () => paused = true);
    track.addEventListener('focusout', () => paused = false);

    const markInteract = () => { userInteracting = true; };
    const unmarkInteract = () => { setTimeout(() => userInteracting = false, 300); };
    track.addEventListener('mousedown', markInteract);
    window.addEventListener('mouseup', unmarkInteract);
    track.addEventListener('touchstart', markInteract, { passive: true });
    window.addEventListener('touchend', unmarkInteract, { passive: true });

    window.addEventListener('resize', () => {
        const firstHalfWidth = items.reduce((w, el) => w + el.getBoundingClientRect().width, 0);
        const styles = getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        loopWidth = firstHalfWidth + gap * (items.length - 1);
    });

    requestAnimationFrame(onFrame);
});
// --- Continuous marquee for CMB Products scroller ---
document.addEventListener('DOMContentLoaded', function () {
    const track = document.querySelector('#cmb-products .product-scroll');
    if (!track) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const items = Array.from(track.children);
    if (items.length === 0) return;

    const originalWidth = track.scrollWidth;
    const overflow = originalWidth > track.clientWidth + 4;
    if (!overflow || items.length < 4) return;
    items.forEach(node => track.appendChild(node.cloneNode(true)));
    let loopWidth = originalWidth;

    track.classList.add('marquee-active');

    let paused = false;
    let userInteracting = false;
    let inView = false;
    let last = performance.now();
    let pxPerSec = 40;

    const onFrame = (now) => {
        const dt = now - last;
        last = now;
        if (!paused && !userInteracting && inView) {
            const delta = (pxPerSec * dt) / 1000;
            track.scrollLeft += delta;
            if (track.scrollLeft >= loopWidth) {
                track.scrollLeft -= loopWidth;
            }
        }
        requestAnimationFrame(onFrame);
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => { inView = entry.isIntersecting; });
    }, { threshold: 0.2 });
    io.observe(track);

    track.addEventListener('mouseenter', () => paused = true);
    track.addEventListener('mouseleave', () => paused = false);
    track.addEventListener('focusin', () => paused = true);
    track.addEventListener('focusout', () => paused = false);

    const markInteract = () => { userInteracting = true; };
    const unmarkInteract = () => { setTimeout(() => userInteracting = false, 300); };
    track.addEventListener('mousedown', markInteract);
    window.addEventListener('mouseup', unmarkInteract);
    track.addEventListener('touchstart', markInteract, { passive: true });
    window.addEventListener('touchend', unmarkInteract, { passive: true });

    window.addEventListener('resize', () => {
        const firstHalfWidth = items.reduce((w, el) => w + el.getBoundingClientRect().width, 0);
        const styles = getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        loopWidth = firstHalfWidth + gap * (items.length - 1);
    });

    requestAnimationFrame(onFrame);
});

// --- Continuous marquee for Green Products scroller ---
document.addEventListener('DOMContentLoaded', function () {
    const track = document.querySelector('#green-products .product-scroll');
    if (!track) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const items = Array.from(track.children);
    if (items.length === 0) return;

    const originalWidth = track.scrollWidth;
    const overflow = originalWidth > track.clientWidth + 4;
    if (!overflow || items.length < 4) return;
    items.forEach(node => track.appendChild(node.cloneNode(true)));
    let loopWidth = originalWidth;

    track.classList.add('marquee-active');

    let paused = false;
    let userInteracting = false;
    let inView = false;
    let last = performance.now();
    let pxPerSec = 40;

    const onFrame = (now) => {
        const dt = now - last;
        last = now;
        if (!paused && !userInteracting && inView) {
            const delta = (pxPerSec * dt) / 1000;
            track.scrollLeft += delta;
            if (track.scrollLeft >= loopWidth) {
                track.scrollLeft -= loopWidth;
            }
        }
        requestAnimationFrame(onFrame);
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => { inView = entry.isIntersecting; });
    }, { threshold: 0.2 });
    io.observe(track);

    track.addEventListener('mouseenter', () => paused = true);
    track.addEventListener('mouseleave', () => paused = false);
    track.addEventListener('focusin', () => paused = true);
    track.addEventListener('focusout', () => paused = false);

    const markInteract = () => { userInteracting = true; };
    const unmarkInteract = () => { setTimeout(() => userInteracting = false, 300); };
    track.addEventListener('mousedown', markInteract);
    window.addEventListener('mouseup', unmarkInteract);
    track.addEventListener('touchstart', markInteract, { passive: true });
    window.addEventListener('touchend', unmarkInteract, { passive: true });

    window.addEventListener('resize', () => {
        const firstHalfWidth = items.reduce((w, el) => w + el.getBoundingClientRect().width, 0);
        const styles = getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        loopWidth = firstHalfWidth + gap * (items.length - 1);
    });

    requestAnimationFrame(onFrame);
});
// --- Generic horizontal drag-to-scroll for product scrollers ---
document.addEventListener('DOMContentLoaded', function() {
    const scrollers = document.querySelectorAll('.h-scroll');
    scrollers.forEach(track => {
        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;
        let isDragging = false;
        let lastX = 0;
        let lastTime = 0;
        let velocity = 0;

        const onDown = (e) => {
            const x = (e.touches ? e.touches[0].clientX : e.clientX);
            isDown = true;
            isDragging = false;
            startX = x;
            scrollLeft = track.scrollLeft;
            lastX = x;
            lastTime = Date.now();
            velocity = 0;
        };
        const onMove = (e) => {
            if (!isDown) return;
            const x = (e.touches ? e.touches[0].clientX : e.clientX);
            const dx = x - startX;
            if (Math.abs(dx) > 4) isDragging = true;
            track.scrollLeft = scrollLeft - dx;
            const now = Date.now();
            const dt = now - lastTime || 16;
            velocity = (x - lastX) / dt;
            lastX = x;
            lastTime = now;
        };
        const onUp = () => {
            if (!isDown) return;
            isDown = false;
            if (Math.abs(velocity) > 0.04) {
                let momentum = velocity * 500;
                const start = track.scrollLeft;
                const duration = 300;
                const startTime = performance.now();
                const step = (t) => {
                    const elapsed = t - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    track.scrollLeft = start - momentum * eased;
                    if (progress < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            }
        };
        // Mouse
        track.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        // Touch
        track.addEventListener('touchstart', onDown, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onUp, { passive: true });
        // Prevent child clicks after drag
        track.addEventListener('click', (e) => {
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
            }
            isDragging = false;
        }, true);
    });
});
// --- Infra Carousel Navigation ---
document.addEventListener('DOMContentLoaded', function() {
    const infraTrack = document.querySelector('.infra-carousel-track');
    // Implement pointer drag-to-scroll with momentum and click suppression
    if (infraTrack) {
        let isDown = false;
        let startX;
        let scrollLeft;
        let isDragging = false;
        let dragDistance = 0;
        let lastX = 0;
        let lastTime = 0;
        let velocity = 0;
        const DRAG_THRESHOLD = 12; // pixels before we consider it a drag

        const onPointerDown = (e) => {
            isDown = true;
            isDragging = false;
            startX = e.pageX || e.clientX;
            scrollLeft = infraTrack.scrollLeft;
            lastX = startX;
            lastTime = Date.now();
            velocity = 0;
            // capture pointer for pointer events on the track element
            if (e.pointerId && infraTrack.setPointerCapture) {
                try { infraTrack.setPointerCapture(e.pointerId); } catch(_) {}
            }
        };

        const onPointerMove = (e) => {
            if (!isDown) return;
            const x = e.pageX || e.clientX;
            const dx = x - startX;
            dragDistance = Math.abs(dx);
            if (dragDistance > DRAG_THRESHOLD) {
                if (!isDragging) {
                    isDragging = true;
                    // add dragging class only once we confirm an actual drag
                    infraTrack.classList.add('dragging');
                }
            }
            infraTrack.scrollLeft = scrollLeft - dx;

            // compute velocity
            const now = Date.now();
            const dt = now - lastTime || 16;
            velocity = (x - lastX) / dt;
            lastX = x;
            lastTime = now;
        };

        const onPointerUp = (e) => {
            if (!isDown) return;
            isDown = false;
            infraTrack.classList.remove('dragging');
            // release pointer capture if used
            if (e.pointerId && infraTrack.releasePointerCapture) {
                try { infraTrack.releasePointerCapture(e.pointerId); } catch(_) {}
            }
            // apply momentum
            if (Math.abs(velocity) > 0.05) {
                let momentum = velocity * 600; // increased multiplier for snappier flick
                const start = infraTrack.scrollLeft;
                const duration = 320; // shorter duration for faster feel
                const startTime = performance.now();

                const step = (t) => {
                    const elapsed = t - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // ease out cubic
                    const eased = 1 - Math.pow(1 - progress, 3);
                    infraTrack.scrollLeft = start - momentum * eased;
                    if (progress < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            }

            // suppress the next click only if it was a true drag (not a tiny move)
            if (isDragging && dragDistance > DRAG_THRESHOLD) {
                const suppressClick = (ev) => {
                    // Allow clicks on controls outside the track; only suppress within the track
                    if (infraTrack.contains(ev.target)) {
                        ev.stopImmediatePropagation();
                        ev.preventDefault();
                    }
                    infraTrack.removeEventListener('click', suppressClick, true);
                };
                // capture only on the track, not the whole document
                infraTrack.addEventListener('click', suppressClick, true);
            }
            // reset drag tracking
            dragDistance = 0;
            isDragging = false;
        };

        const hasPointer = 'PointerEvent' in window;
        if (hasPointer) {
            // Pointer events path
            infraTrack.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        } else {
            // Mouse fallback
            infraTrack.addEventListener('mousedown', onPointerDown);
            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
            // Touch events
            infraTrack.addEventListener('touchstart', (e) => onPointerDown(e.touches[0] || e), {passive:false});
            window.addEventListener('touchmove', (e) => onPointerMove(e.touches[0] || e), {passive:false});
            window.addEventListener('touchend', (e) => onPointerUp(e.changedTouches ? e.changedTouches[0] : e));
        }

        // Click delegation: open modal when clicking anywhere on a card (unless a real drag just occurred)
        infraTrack.addEventListener('click', (e) => {
            // If a drag suppression is in place, capture-phase handler will have prevented this
            const card = e.target.closest('.infra-card');
            if (!card || !infraTrack.contains(card)) return;
            e.preventDefault();
            openInfraCard(card);
        });
    }
});
// ...existing code...
// Manufacturing Capabilities gallery data
const infrastructureData = {
    'sheet-metal': {
        title: 'Sheet Metal Fabrication',
        images: [
            { src: 'sheet metal cutting/Laser cutting 2kW.png', caption: 'Laser Cutting Machine -2kW' },
            { src: 'sheet metal cutting/Laser cutting 3kW.png', caption: 'Laser Cutting Machine -3kW' },
            { src: 'sheet metal cutting/Press break 150 ton.png', caption: 'Press break -150ton' },
            { src: 'sheet metal cutting/Press break 75 ton.png', caption: 'Press break -75ton' }
        ],
        items: [
            {
                title: 'Utilize high-power laser cutting machines for precision and heavy-duty tasks',
                desc: 'Equipped with 2 kW lasers for precision cutting and 3 kW lasers for heavy-duty applications, enabling versatile and accurate sheet metal processing.'
            },
            {
                title: 'Employ press brakes with varying capacities for flexible forming needs',
                desc: 'Press brakes feature 75-ton capacity for versatile forming and 150-ton capacity for large-scale bending, supporting diverse fabrication requirements.'
            }
        ],
        // Fallback (not used when items exist)
        description: '',
        points: []
    },
    'complex-machines': {
        title: 'CNC and Multi-Axis Machining',
        images: [
            { src: 'Complex machine/CNC honing.png', caption: 'CNC Honing' },
            { src: 'Complex machine/CNC turning.png', caption: 'CNC Turning' },
            { src: 'Complex machine/VMC 3axis.png', caption: 'VMC -3Axis' },
            { src: 'Complex machine/VMC 5axis.png', caption: 'VMC -5Axis' }
        ],
        items: [
            {
                title: 'UTILIZE VMC 5 AXIS & 3 AXIS FOR COMPLEX GEOMETRIES',
                desc: 'Enable Machining of Parts With Tight Tolerances And Intricate Shapes, Supporting Advanced Manufacturing Requirements.'
            },
            {
                title: 'EMPLOY CNC TURNING FOR HIGH PRECISION ROTATIONAL PARTS',
                desc: 'Manufacture Rotational Components With Superior Accuracy And Consistency, Ideal For Automotive And HVAC Applications.'
            },
            {
                title: 'IMPLEMENT CNC HONING FOR OPTIMAL SURFACE FINISHING',
                desc: 'Enhance Part Performance Through Precise Surface Finishing Techniques That Improve Durability And Function.'
            }
        ],
        description: '',
        points: []
    },
    'welding': {
        title: 'Robotic and Specialized Welding',
        images: [
            { src: 'welding/Laser Welding.png', caption: 'Laser Welding' },
            { src: 'welding/Mig welding.png', caption: 'Mig Welding' },
            { src: 'welding/robotic welding.png', caption: 'Robotic Welding' },
            { src: 'welding/Spot welding.png', caption: 'Spot Welding' },
            { src: 'welding/Tig welding.png', caption: 'Tig Welding' },
            { src: 'welding/welding SPM.png', caption: 'Welding SPM' }
        ],
        items: [
            {
                title: 'Flexible process coverage',
                desc: 'Utilize MIG, TIG, and laser welding techniques that offer flexibility for different material types and thicknesses, ensuring precise and effective welds.'
            },
            {
                title: 'Robotic welding for consistency',
                desc: 'Robotic welding systems deliver uniform welds that enhance assembly reliability and reduce defects, meeting procurement demands for consistent quality.'
            },
            {
                title: 'High-volume throughput with SPM & spot welding',
                desc: 'Deploy Special Purpose Machines (SPM) and spot welding to optimize high-volume production, supporting scalable manufacturing needs.'
            }
        ],
        description: '',
        points: []
    },
    'tubular': {
        title: 'Tubular Fabrication Facilities',
        images: [
            { src: 'tubular/CNC pipe bend 3axis.png', caption: 'CNC Pipe Bending -3Axis' },
            { src: 'tubular/CNC pipe bend 5axis.png', caption: 'CNC Pipe Bending -5axis' },
            { src: 'tubular/NC pipe bend.png', caption: 'NC Pipe Bending Machine' }
        ],
        items: [
            {
                title: 'Manufacture complex tubular assemblies using CNC pipe bending machines',
                desc: 'Utilize 5 Axis and 3 Axis CNC Pipe Bending Machines to create intricate tubular shapes with high dimensional accuracy and surface quality.'
            },
            {
                title: 'Achieve precise bends with NC pipe bending technology',
                desc: 'Employ NC Pipe Bending Machines to deliver precise pipe bends essential for complex tubular fabrication projects.'
            }
        ],
        description: '',
        points: []
    },
    'infrastructure': {
        title: 'Supporting Facilities and Processes',
        images: [
            { src: 'infra/powder coating room.png', caption: 'Powder Coating Room' },
            { src: 'infra/press shop.png', caption: 'Press Shop' },
            { src: 'infra/tool room.png', caption: 'Tool Room' }
        ],
        description: 'Our facility includes a tool room for precision design and maintenance of essential tools, a press room equipped with high-performance presses for accurate shaping and assembly of components, and a powder coating facility that delivers durable, high-quality finishes to enhance both protection and aesthetics.',
        points: []
    },
    'others': {
        title: 'Quality & Assembly Equipment',
        images: [
            { src: 'others/hose crimping.png', caption: 'Hose Crimping Machine' },
            { src: 'others/hose cutting.png', caption: 'Hose Cutting Machine' },
            { src: 'others/hydrofoaming.png', caption: 'Hydroforming Machine' },
            { src: 'others/induction brazing.png', caption: 'Induction Brazing Machine' },
            { src: 'others/pressure decay leak tester.png', caption: 'Pressure Decay Leak Tester' },
            { src: 'others/tube end reforming.png', caption: 'Tube End Forming Machine' },
            { src: 'others/ultrasonic.png', caption: 'Ultrasonic Washing Machine' }
        ],
        items: [
            {
                title: 'Specialized machines for pipe forming',
                desc: 'Employ Tube End Forming Machine, Hydroforming Machine, Hose Crimping Machine, and Hose Cutting Machine to achieve precise tube and hose fabrication essential for product assembly.'
            },
            {
                title: 'Implement advanced joining and brazing technology',
                desc: 'Use Induction Brazing Machine to ensure strong, reliable joints critical for product durability and performance.'
            },
            {
                title: 'Conduct rigorous leak testing for quality assurance',
                desc: 'Apply Pressure Decay Leak Tester to verify leak-proof assemblies, maintaining high product integrity and compliance with quality standards.'
            },
            {
                title: 'Ensure compliance with MNC procurement and quality standards',
                desc: 'Leverage advanced equipment and processes to meet strict quality control requirements aligned with multinational corporation procurement standards.'
            }
        ],
        description: '',
        points: []
    }
};

// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}));

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});



// ...existing code...

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.insight-card, .features-text, .features-image');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Add loading animation to hero section
window.addEventListener('load', () => {
    const heroContent = document.querySelector('.hero-content');
    const heroImage = document.querySelector('.hero-image');
    
    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.transform = 'translateY(50px)';
        heroContent.style.transition = 'opacity 1s ease, transform 1s ease';
        
        setTimeout(() => {
            heroContent.style.opacity = '1';
            heroContent.style.transform = 'translateY(0)';
        }, 300);
    }
    
    if (heroImage) {
        heroImage.style.opacity = '0';
        heroImage.style.transform = 'translateX(50px)';
        heroImage.style.transition = 'opacity 1s ease, transform 1s ease';
    }

        // Initialize Infrastructure Modal (run regardless of hero image presence)
        const infraModal = document.getElementById('infraModal');
        const modalClose = document.querySelector('.modal-close');
        const modalHeader = document.querySelector('.modal-header');
        const modalGallery = document.querySelector('.modal-gallery');
        const imageCounter = document.querySelector('.image-counter');
        const thumbnailsContainer = document.querySelector('.thumbnails-container');
        const prevBtn = document.querySelector('.modal-prev');
        const nextBtn = document.querySelector('.modal-next');
        const thumbScrollLeft = document.querySelector('.thumb-scroll-left');
        const thumbScrollRight = document.querySelector('.thumb-scroll-right');
        const sideBlurb = document.querySelector('.modal-info-blurb');
        const sidePoints = document.querySelector('.modal-info-points');
    let sideItems = document.querySelector('.modal-info-items');
    let lastFocusedTrigger = null; // to restore focus on close
        
        let currentImageIndex = 0;
        let currentImages = [];

        // Ensure the main image fits fully within the modal (no clipping)
        function sizeModalImageArea() {
            const header = document.querySelector('.modal-header');
            const main = document.querySelector('.modal-main');
            const thumbs = document.querySelector('.modal-thumbnails');
            const galleryImg = document.querySelector('.modal-gallery img');
            if (!main) return;
            const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
            const headerH = header ? header.getBoundingClientRect().height : 0;
            const thumbsH = thumbs ? thumbs.getBoundingClientRect().height : 0;
            // Leave a little breathing room (16px)
            const available = Math.max(240, vh - headerH - thumbsH - 16);
            main.style.minHeight = available + 'px';
            // If an image is present, ensure it doesn't exceed available space
            if (galleryImg) {
                galleryImg.style.maxHeight = (available - 40) + 'px';
            }
        }

        function updateImageCounter() {
            imageCounter.textContent = `${currentImageIndex + 1} / ${currentImages.length}`;
        }

        function showImage(index) {
            modalGallery.innerHTML = '';
            const img = document.createElement('img');
            img.src = currentImages[index].src;
            img.alt = currentImages[index].caption;
            // Re-size once the image loads for exact dimensions
            img.addEventListener('load', sizeModalImageArea);
            
            const caption = document.createElement('p');
            caption.textContent = currentImages[index].caption;
            caption.className = 'modal-caption';
            
            modalGallery.appendChild(img);
            modalGallery.appendChild(caption);
            updateImageCounter();
            // Also call sizing to handle quick transitions
            sizeModalImageArea();

            // Sidebar no longer mirrors image caption; keep only on image

            // Update thumbnails
            const thumbnails = thumbnailsContainer.querySelectorAll('.thumbnail');
            thumbnails.forEach((thumb, i) => {
                thumb.classList.toggle('active', i === index);
            });

            // Scroll thumbnail into view
            const activeThumb = thumbnails[index];
            if (activeThumb) {
                activeThumb.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }

        function createThumbnails() {
            thumbnailsContainer.innerHTML = '';
            currentImages.forEach((image, index) => {
                const thumbnail = document.createElement('div');
                thumbnail.className = `thumbnail ${index === currentImageIndex ? 'active' : ''}`;
                
                const thumbImg = document.createElement('img');
                thumbImg.src = image.src;
                thumbImg.alt = `Thumbnail ${index + 1}`;
                
                thumbnail.appendChild(thumbImg);
                thumbnail.addEventListener('click', () => {
                    currentImageIndex = index;
                    showImage(currentImageIndex);
                });
                
                thumbnailsContainer.appendChild(thumbnail);
            });
        }

        // Open modal helper so any part of the card can trigger it
        function openInfraCard(card) {
            lastFocusedTrigger = card; // remember what opened the modal
            const category = card.dataset.category;
            const data = infrastructureData[category];
            if (!data) return;
            currentImages = data.images;
            currentImageIndex = 0;
            modalHeader.textContent = data.title;
            // Optional description and points if present in data
            // Prefer structured items (title + description per item) when present
            const hasItems = Array.isArray(data.items) && data.items.length > 0;
            // Ensure items container exists; if not, create it so content is visible
            if (!sideItems && hasItems) {
                const infoContent = document.querySelector('.modal-info-content');
                if (infoContent) {
                    const container = document.createElement('div');
                    container.className = 'modal-info-items';
                    infoContent.insertBefore(container, sidePoints || null);
                    sideItems = container;
                }
            }

            if (sideItems) {
                sideItems.innerHTML = '';
                if (hasItems) {
                    data.items.forEach(item => {
                        const wrap = document.createElement('div');
                        wrap.className = 'modal-info-item';

                        if (item.title) {
                            const h4 = document.createElement('h4');
                            h4.className = 'modal-info-item-title';
                            h4.textContent = item.title;
                            wrap.appendChild(h4);
                        }
                        if (item.desc) {
                            const p = document.createElement('p');
                            p.className = 'modal-info-item-desc';
                            p.textContent = item.desc;
                            wrap.appendChild(p);
                        }
                        sideItems.appendChild(wrap);
                    });
                }
                // Show/hide items container based on data
                sideItems.style.display = hasItems ? 'block' : 'none';
            }

            // If items exist and container is present, hide blurb/points; else use fallback blurb + points
            const useFallback = !hasItems || !sideItems;
            if (sideBlurb) {
                sideBlurb.textContent = useFallback && typeof data.description === 'string' ? data.description : '';
                sideBlurb.style.display = useFallback && data.description ? 'block' : 'none';
            }
            if (sidePoints) {
                sidePoints.innerHTML = '';
                if (useFallback && Array.isArray(data.points)) {
                    data.points.forEach(pt => {
                        const li = document.createElement('li');
                        li.textContent = pt;
                        sidePoints.appendChild(li);
                    });
                }
                sidePoints.style.display = useFallback && Array.isArray(data.points) && data.points.length ? 'block' : 'none';
            }
            createThumbnails();
            showImage(currentImageIndex);
            // Size on open
            sizeModalImageArea();
            // Open modal with accessibility attributes
            infraModal.style.display = 'block';
            infraModal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open'); // hide navbar + lock scroll

            // Focus management: trap focus inside modal
            const focusableSelectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
            const focusable = Array.from(infraModal.querySelectorAll(focusableSelectors)).filter(el => el.offsetParent !== null || el === document.activeElement);
            const firstFocusable = focusable[0] || modalClose || infraModal;
            const lastFocusable = focusable[focusable.length - 1] || firstFocusable;
            // Move focus to modal content or close button
            setTimeout(() => {
                (firstFocusable instanceof HTMLElement ? firstFocusable : infraModal).focus();
            }, 0);

            function trapFocus(e) {
                if (e.key !== 'Tab') return;
                if (focusable.length === 0) {
                    e.preventDefault();
                    (infraModal instanceof HTMLElement ? infraModal : document.body).focus();
                    return;
                }
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            }
            infraModal.addEventListener('keydown', trapFocus);
            infraModal._trapFocus = trapFocus; // store for cleanup
        }

        // Bind clicks to the whole card plus its main regions
        document.querySelectorAll('.infra-card').forEach(card => {
            // Entire card
            card.style.cursor = 'pointer';
            // Make the card focusable for keyboard users
            if (!card.hasAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            card.addEventListener('click', (ev) => {
                // If user really dragged, ignore this click (track handler will suppress anyway)
                openInfraCard(card);
            });
            // Keyboard activate
            card.addEventListener('keydown', (ev) => {
                const key = ev.key;
                if (key === 'Enter' || key === ' ') {
                    ev.preventDefault();
                    openInfraCard(card);
                }
            });
            // Image area
            const imgWrap = card.querySelector('.infra-card-img-wrapper');
            if (imgWrap) {
                imgWrap.style.cursor = 'pointer';
                imgWrap.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    openInfraCard(card);
                });
            }
            // Info/text area
            const info = card.querySelector('.infra-card-info');
            if (info) {
                info.style.cursor = 'pointer';
                info.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    openInfraCard(card);
                });
            }
        });

        // Modal controls
        function closeModalAndRestoreFocus() {
            infraModal.style.display = 'none';
            infraModal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            if (infraModal._trapFocus) infraModal.removeEventListener('keydown', infraModal._trapFocus);
            // restore focus to trigger
            if (lastFocusedTrigger && lastFocusedTrigger.focus) {
                setTimeout(() => lastFocusedTrigger.focus(), 0);
            }
        }

        modalClose && modalClose.addEventListener('click', closeModalAndRestoreFocus);
        // Support keyboard activation for the close element
        modalClose && modalClose.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModalAndRestoreFocus();
            }
        });

        prevBtn && prevBtn.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
            showImage(currentImageIndex);
        });

        nextBtn && nextBtn.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex + 1) % currentImages.length;
            showImage(currentImageIndex);
        });

        // Recompute size on window resize
        window.addEventListener('resize', () => {
            sizeModalImageArea();
        });

        // Thumbnail scroll controls
        thumbScrollLeft && thumbScrollLeft.addEventListener('click', () => {
            thumbnailsContainer.scrollBy({
                left: -200,
                behavior: 'smooth'
            });
        });

        thumbScrollRight && thumbScrollRight.addEventListener('click', () => {
            thumbnailsContainer.scrollBy({
                left: 200,
                behavior: 'smooth'
            });
        });

        // Close modal on outside click
        infraModal && infraModal.addEventListener('click', (e) => {
            if (e.target === infraModal) {
                closeModalAndRestoreFocus();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (infraModal && infraModal.style.display === 'block') {
                if (e.key === 'ArrowLeft') {
                    prevBtn && prevBtn.click();
                } else if (e.key === 'ArrowRight') {
                    nextBtn && nextBtn.click();
                } else if (e.key === 'Escape') {
                    closeModalAndRestoreFocus();
                }
            }
        });

        // Finish hero image animation after setup
        setTimeout(() => {
            heroImage.style.opacity = '1';
            heroImage.style.transform = 'translateX(0)';
        }, 600);
    
});

// Add hover effects to buttons
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
    });
    
    btn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Add click animation to insight cards
document.querySelectorAll('.insight-card').forEach(card => {
    card.addEventListener('click', function() {
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = 'translateY(-10px)';
        }, 150);
    });
});

// Form validation and submission (for contact forms)
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.style.borderColor = '#ef4444';
            isValid = false;
        } else {
            input.style.borderColor = '#10b981';
        }
    });
    
    return isValid;
}

// Add form submission handler if contact form exists
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.querySelector('#contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (validateForm(this)) {
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'success-message';
                successMsg.textContent = 'Thank you! Your message has been sent successfully.';
                successMsg.style.cssText = `
                    background: #10b981;
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-top: 1rem;
                    text-align: center;
                `;
                this.appendChild(successMsg);
                
                // Reset form
                this.reset();
                
                // Remove success message after 5 seconds
                setTimeout(() => {
                    successMsg.remove();
                }, 5000);
            }
        });
    }
});

// Add scroll-to-top functionality
const scrollToTopBtn = document.createElement('button');
scrollToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
scrollToTopBtn.className = 'scroll-to-top';
// Add hover tooltip and accessibility label
scrollToTopBtn.setAttribute('title', 'Go to top');
scrollToTopBtn.setAttribute('aria-label', 'Go to top');
scrollToTopBtn.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 50px;
    height: 50px;
    background: #00C853;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: none;
    z-index: 1000;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 200, 83, 0.3);
`;

document.body.appendChild(scrollToTopBtn);

window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        scrollToTopBtn.style.display = 'block';
    } else {
        scrollToTopBtn.style.display = 'none';
    }
});

scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Add typing effect to hero title

// Typewriter effect that preserves HTML tags
function typeWriter(element, html, speed = 100) {
    let i = 0;
    let isTag = false;
    let tagBuffer = '';
    element.innerHTML = '';

    function type() {
        if (i < html.length) {
            let char = html.charAt(i);
            if (char === '<') {
                isTag = true;
                tagBuffer = '';
            }
            if (isTag) {
                tagBuffer += char;
                if (char === '>') {
                    element.innerHTML += tagBuffer;
                    isTag = false;
                }
            } else {
                element.innerHTML += char;
            }
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Set hero title as fixed HTML (no animation)
window.addEventListener('load', () => {
    const heroTitle = document.querySelector('.hero-title');
    // Do not overwrite if block rotator is present
    if (heroTitle && !heroTitle.querySelector('#hero-rotator')) {
        heroTitle.innerHTML = '<span class="highlight">REVVING UP</span><br><span class="highlight">RELIABILITY</span>';
    }
});

// FAQ functionality
document.addEventListener('DOMContentLoaded', () => {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close all other FAQ items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
});

// Add smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});



// ...existing code...

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.insight-card, .features-text, .features-image, .product-card, .service-item, .team-member, .mv-card, .impact-card, .tech-item, .cert-item, .goal-item');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// Add counter animation for stats
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => {
        if (counter.classList.contains('stat-number-label')) return;
        const target = parseInt(counter.textContent.replace(/\D/g, ''));
        const duration = 2000; // 2 seconds
        const increment = target / (duration / 16); // 60fps
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            if (counter.textContent.includes('%')) {
                counter.textContent = Math.floor(current) + '%';
            } else if (counter.textContent.includes('+')) {
                counter.textContent = Math.floor(current) + '+';
            } else {
                counter.textContent = Math.floor(current);
            }
        }, 16);
    });
}

// Trigger counter animation when stats section is visible
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.addEventListener('DOMContentLoaded', () => {
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        statsObserver.observe(statsSection);
    }
});

// Add parallax effect to hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero) {
        const rate = scrolled * -0.5;
        hero.style.transform = `translateY(${rate}px)`;
    }
});

// Add form validation enhancements
function enhanceFormValidation() {
    const form = document.querySelector('#contact-form');
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    // Remove existing error styling
    field.classList.remove('error');
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'This field is required';
    }
    
    // Email validation
    if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }
    
    // Phone validation
    if (field.type === 'tel' && value) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
        }
    }
    
    if (!isValid) {
        field.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = errorMessage;
        errorDiv.style.cssText = 'color: #ef4444; font-size: 0.875rem; margin-top: 0.25rem;';
        field.parentNode.appendChild(errorDiv);
    }
    
    return isValid;
}

// Initialize form validation
document.addEventListener('DOMContentLoaded', enhanceFormValidation);

// Add CSS for error states
const style = document.createElement('style');
style.textContent = `
    .form-group input.error,
    .form-group select.error,
    .form-group textarea.error {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
`;
document.head.appendChild(style);

// Quote modal removed: Get a Quote now links to contact.html