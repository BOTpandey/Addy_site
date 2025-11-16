
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
        // Accessibility: when an element inside the track receives focus, update visual focus
        // and pause autoplay. When focus leaves the entire track, clear focused state so the
        // "Click for More" tag disappears immediately.
        infraTrack.addEventListener('focusin', (e) => {
            isPaused = true;
            // If focus moved to a card (keyboard navigation), reflect that in the carousel focus
            const card = (e.target && e.target.closest) ? e.target.closest('.infra-card') : null;
            if (card) {
                const idx = Array.prototype.indexOf.call(infraCards, card);
                if (idx >= 0) {
                    // Do not scroll when user is tabbing; just update visuals
                    setFocus(idx, { scroll: false });
                }
            }
        });
        infraTrack.addEventListener('focusout', (e) => {
            // Only resume if focus has moved completely outside the track
            const next = e.relatedTarget;
            if (!next || !infraTrack.contains(next)) {
                isPaused = false;
                startAutoFocus();
                // Remove any visual focus so the "Click for More" tag is hidden
                infraCards.forEach(c => c.classList.remove('infra-card-focus'));
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

    function updateArrowStates() {
        if (!prevBtn || !nextBtn || !infraCards.length) return;
        
        // Store boundary states for manual click prevention
        prevBtn.dataset.atBoundary = focusIndex === 0;
        nextBtn.dataset.atBoundary = focusIndex === infraCards.length - 1;
        
        // Keep arrows visually enabled but add visual indication when at boundaries
        prevBtn.style.opacity = focusIndex === 0 ? '0.7' : '1';
        nextBtn.style.opacity = focusIndex === infraCards.length - 1 ? '0.7' : '1';
    }

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
            if (prevBtn.dataset.atBoundary === 'true' || !infraCards.length) return;
            pauseAndResumeLater();
            const idx = focusIndex - 1;
            setFocus(idx, { scroll: true });
            updateArrowStates();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (nextBtn.dataset.atBoundary === 'true' || !infraCards.length) return;
            pauseAndResumeLater();
            const idx = focusIndex + 1;
            setFocus(idx, { scroll: true });
            updateArrowStates();
        });
    }

    // Update arrow states initially
    updateArrowStates();
    
    // Update arrow states periodically to keep them in sync (but don't interfere with auto-focus)
    setInterval(updateArrowStates, 1000);
});

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

// Initialize Infrastructure Modal
document.addEventListener('DOMContentLoaded', function() {
    const infraModal = document.getElementById('infraModal');
    const infraModalClose = infraModal ? infraModal.querySelector('.modal-close') : null;
    const modalHeader = infraModal ? infraModal.querySelector('.modal-header') : null;
    const modalGallery = infraModal ? infraModal.querySelector('.modal-gallery') : null;
    const imageCounter = infraModal ? infraModal.querySelector('.image-counter') : null;
    const thumbnailsContainer = infraModal ? infraModal.querySelector('.thumbnails-container') : null;
    const prevBtn = infraModal ? infraModal.querySelector('.modal-prev') : null;
    const nextBtn = infraModal ? infraModal.querySelector('.modal-next') : null;
    const thumbScrollLeft = infraModal ? infraModal.querySelector('.thumb-scroll-left') : null;
    const thumbScrollRight = infraModal ? infraModal.querySelector('.thumb-scroll-right') : null;
    const sideBlurb = infraModal ? infraModal.querySelector('.modal-info-blurb') : null;
    const sidePoints = infraModal ? infraModal.querySelector('.modal-info-points') : null;
    let sideItems = infraModal ? infraModal.querySelector('.modal-info-items') : null;
    let lastFocusedTrigger = null; // to restore focus on close
    
    let currentImageIndex = 0;
    let currentImages = [];

    // Make modal variables globally accessible
    window.infraModal = infraModal;
    window.infraModalClose = infraModalClose;
    window.modalHeader = modalHeader;
    window.modalGallery = modalGallery;
    window.imageCounter = imageCounter;
    window.thumbnailsContainer = thumbnailsContainer;
    window.prevBtn = prevBtn;
    window.nextBtn = nextBtn;
    window.thumbScrollLeft = thumbScrollLeft;
    window.thumbScrollRight = thumbScrollRight;
    window.sideBlurb = sideBlurb;
    window.sidePoints = sidePoints;
    window.sideItems = sideItems;
    window.lastFocusedTrigger = lastFocusedTrigger;
    window.currentImageIndex = currentImageIndex;
    window.currentImages = currentImages;

    // Helper functions for modal
    function sizeModalImageArea() {
        const header = window.infraModal ? window.infraModal.querySelector('.modal-header') : null;
        const main = window.infraModal ? window.infraModal.querySelector('.modal-main') : null;
        const thumbs = window.infraModal ? window.infraModal.querySelector('.modal-thumbnails') : null;
        const galleryImg = window.infraModal ? window.infraModal.querySelector('.modal-gallery img') : null;
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
        window.imageCounter.textContent = `${window.currentImageIndex + 1} / ${window.currentImages.length}`;
    }

    function showImage(index) {
        window.modalGallery.innerHTML = '';
        const img = document.createElement('img');
        img.src = window.currentImages[index].src;
        img.alt = window.currentImages[index].caption;
        // Re-size once the image loads for exact dimensions
        img.addEventListener('load', sizeModalImageArea);
        
        const caption = document.createElement('p');
        caption.textContent = window.currentImages[index].caption;
        caption.className = 'modal-caption';
        
        window.modalGallery.appendChild(img);
        window.modalGallery.appendChild(caption);
        updateImageCounter();
        // Also call sizing to handle quick transitions
        sizeModalImageArea();

        // Sidebar no longer mirrors image caption; keep only on image

        // Update thumbnails
        const thumbnails = window.thumbnailsContainer.querySelectorAll('.thumbnail');
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
        window.thumbnailsContainer.innerHTML = '';
        window.currentImages.forEach((image, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = `thumbnail ${index === window.currentImageIndex ? 'active' : ''}`;
            
            const thumbImg = document.createElement('img');
            thumbImg.src = image.src;
            thumbImg.alt = `Thumbnail ${index + 1}`;
            
            thumbnail.appendChild(thumbImg);
            thumbnail.addEventListener('click', () => {
                window.currentImageIndex = index;
                showImage(window.currentImageIndex);
            });
            
            window.thumbnailsContainer.appendChild(thumbnail);
        });
    }

    // Open modal helper function
    window.openInfraCard = function openInfraCard(card) {
        console.log('openInfraCard called with card:', card);
        if (!window.infraModal) {
            console.log('Modal not initialized');
            return;
        }
        console.log('Modal found, proceeding...');
        window.lastFocusedTrigger = card; // remember what opened the modal
        const category = card.dataset.category;
        const data = infrastructureData[category];
        if (!data) {
            return;
        }
        window.currentImages = data.images;
        window.currentImageIndex = 0;
        window.modalHeader.textContent = data.title;
        // Optional description and points if present in data
        // Prefer structured items (title + description per item) when present
        const hasItems = Array.isArray(data.items) && data.items.length > 0;
        // Ensure items container exists; if not, create it so content is visible
        if (!window.sideItems && hasItems) {
            const infoContent = window.infraModal ? window.infraModal.querySelector('.modal-info-content') : null;
            if (infoContent) {
                const container = document.createElement('div');
                container.className = 'modal-info-items';
                infoContent.insertBefore(container, window.sidePoints || null);
                window.sideItems = container;
            }
        }

        if (window.sideItems) {
            window.sideItems.innerHTML = '';
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
                    window.sideItems.appendChild(wrap);
                });
            }
            // Show/hide items container based on data
            window.sideItems.style.display = hasItems ? 'block' : 'none';
        }

        // If items exist and container is present, hide blurb/points; else use fallback blurb + points
        const useFallback = !hasItems || !window.sideItems;
        if (window.sideBlurb) {
            window.sideBlurb.textContent = useFallback && typeof data.description === 'string' ? data.description : '';
            window.sideBlurb.style.display = useFallback && data.description ? 'block' : 'none';
        }
        if (window.sidePoints) {
            window.sidePoints.innerHTML = '';
            if (useFallback && Array.isArray(data.points)) {
                data.points.forEach(pt => {
                    const li = document.createElement('li');
                    li.textContent = pt;
                    window.sidePoints.appendChild(li);
                });
            }
            window.sidePoints.style.display = useFallback && Array.isArray(data.points) && data.points.length ? 'block' : 'none';
        }
        createThumbnails();
        showImage(window.currentImageIndex);
        // Size on open
        sizeModalImageArea();
        // Open modal with accessibility attributes
        window.infraModal.style.display = 'block';
        window.infraModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open'); // hide navbar + lock scroll
        // Hide scroll-to-top while modal is open
        if (window.updateScrollToTopVisibility) window.updateScrollToTopVisibility();

        // Focus management: trap focus inside modal
        const focusableSelectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
        const focusable = Array.from(window.infraModal.querySelectorAll(focusableSelectors)).filter(el => el.offsetParent !== null || el === document.activeElement);
        const firstFocusable = focusable[0] || window.infraModalClose || window.infraModal;
        const lastFocusable = focusable[focusable.length - 1] || firstFocusable;
        // Move focus to modal content or close button
        setTimeout(() => {
            (firstFocusable instanceof HTMLElement ? firstFocusable : window.infraModal).focus();
        }, 0);

        // Ensure the "Click for More" tag is not left visible on the underlying card
        // once the modal opens. Remove the visual focus class from all infra cards so
        // the indicator only appears while a card is actually focused in the carousel.
        try {
            document.querySelectorAll('.infra-card').forEach(c => c.classList.remove('infra-card-focus'));
        } catch (e) {
            // silent
        }

        function trapFocus(e) {
            if (e.key !== 'Tab') return;
            if (focusable.length === 0) {
                e.preventDefault();
                (window.infraModal instanceof HTMLElement ? window.infraModal : document.body).focus();
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
        window.infraModal.addEventListener('keydown', trapFocus);
        window.infraModal._trapFocus = trapFocus; // store for cleanup
    };

    // Modal control functions
    function closeModalAndRestoreFocus() {
        window.infraModal.style.display = 'none';
        window.infraModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (window.updateScrollToTopVisibility) window.updateScrollToTopVisibility();
        if (window.infraModal._trapFocus) window.infraModal.removeEventListener('keydown', window.infraModal._trapFocus);
        // restore focus to trigger
        // Ensure no infra card retains the visual focus class
        try { document.querySelectorAll('.infra-card').forEach(c => c.classList.remove('infra-card-focus')); } catch (e) {}

        if (window.lastFocusedTrigger && window.lastFocusedTrigger.focus) {
            const trigger = window.lastFocusedTrigger;
            // If the trigger was an infra card, avoid moving focus back to it (that would re-show the tag).
            // Instead, move focus to the infrastructure section container for a sensible landing spot.
            if (trigger.classList && trigger.classList.contains('infra-card')) {
                const infraSection = document.querySelector('.infrastructure');
                if (infraSection) {
                    // Make it temporarily focusable, focus it, then remove tabindex
                    infraSection.setAttribute('tabindex', '-1');
                    setTimeout(() => {
                        infraSection.focus();
                        infraSection.removeAttribute('tabindex');
                    }, 0);
                } else {
                    // Fallback: blur the trigger
                    setTimeout(() => { try { trigger.blur(); } catch (e) {} }, 0);
                }
            } else {
                setTimeout(() => trigger.focus(), 0);
            }
        }
    }

    // Modal event handlers
    window.infraModalClose && window.infraModalClose.addEventListener('click', closeModalAndRestoreFocus);
    // Support keyboard activation for the close element
    window.infraModalClose && window.infraModalClose.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            closeModalAndRestoreFocus();
        }
    });

    window.prevBtn && window.prevBtn.addEventListener('click', () => {
        window.currentImageIndex = (window.currentImageIndex - 1 + window.currentImages.length) % window.currentImages.length;
        showImage(window.currentImageIndex);
    });

    window.nextBtn && window.nextBtn.addEventListener('click', () => {
        window.currentImageIndex = (window.currentImageIndex + 1) % window.currentImages.length;
        showImage(window.currentImageIndex);
    });

    // Recompute size on window resize
    window.addEventListener('resize', () => {
        sizeModalImageArea();
    });

    // Thumbnail scroll controls
    window.thumbScrollLeft && window.thumbScrollLeft.addEventListener('click', () => {
        window.thumbnailsContainer.scrollBy({
            left: -200,
            behavior: 'smooth'
        });
    });

    window.thumbScrollRight && window.thumbScrollRight.addEventListener('click', () => {
        window.thumbnailsContainer.scrollBy({
            left: 200,
            behavior: 'smooth'
        });
    });

    // Close modal on outside click
    window.infraModal && window.infraModal.addEventListener('click', (e) => {
        if (e.target === window.infraModal) {
            closeModalAndRestoreFocus();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (window.infraModal && window.infraModal.style.display === 'block') {
            if (e.key === 'ArrowLeft') {
                window.prevBtn && window.prevBtn.click();
            } else if (e.key === 'ArrowRight') {
                window.nextBtn && window.nextBtn.click();
            } else if (e.key === 'Escape') {
                closeModalAndRestoreFocus();
            }
        }
    });
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
        let suppressNextClick = false;
        const DRAG_THRESHOLD = 12; // pixels before we consider it a drag

        const onPointerDown = (e) => {
            // Check if the pointer down is on a card - if so, don't start drag
            const card = e.target.closest('.infra-card');
            if (card) {
                console.log('Pointer down on card, not starting drag');
                return; // Don't start drag if clicking on a card
            }
            
            console.log('Pointer down on track');
            isDown = true;
            isDragging = false;
            suppressNextClick = false;
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
            
            // Check if we're moving over a card - if so, stop drag
            const card = e.target.closest('.infra-card');
            if (card) {
                console.log('Moving over card, stopping drag');
                isDown = false;
                isDragging = false;
                infraTrack.classList.remove('dragging');
                return;
            }
            
            const x = e.pageX || e.clientX;
            const dx = x - startX;
            dragDistance = Math.abs(dx);
            if (dragDistance > DRAG_THRESHOLD) {
                if (!isDragging) {
                    console.log('Drag started, suppressNextClick = true');
                    isDragging = true;
                    suppressNextClick = true;
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
            console.log('Pointer up, suppressNextClick =', suppressNextClick);
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

        // Add click event listeners directly to each card
        const infraCards = infraTrack.querySelectorAll('.infra-card');
        console.log('Found', infraCards.length, 'infrastructure cards');
        
        // Temporarily add CSS to ensure cards are clickable
        const style = document.createElement('style');
        style.textContent = `
            .infra-card {
                pointer-events: auto !important;
                position: relative !important;
                z-index: 10 !important;
            }
        `;
        document.head.appendChild(style);
        
        infraCards.forEach((card, index) => {
            console.log(`Setting up click listener for card ${index}:`, card.dataset.category);
            console.log('Card element:', card);
            console.log('Card computed style:', window.getComputedStyle(card));
            console.log('Card pointer-events:', window.getComputedStyle(card).pointerEvents);
            
            // Add a test event to see if the card is clickable
            card.addEventListener('mouseenter', () => {
                console.log('Mouse entered card:', card.dataset.category);
            });
            
            card.addEventListener('mousedown', (e) => {
                console.log('Mouse down on card:', card.dataset.category);
                console.log('Mouse down event:', e);
            });
            
            card.addEventListener('click', (e) => {
                console.log('Card clicked:', card.dataset.category);
                console.log('Click event details:', e);
                
                // Suppress click if there was a recent drag
                if (suppressNextClick) {
                    console.log('Click suppressed due to drag');
                    suppressNextClick = false;
                    return;
                }
                
                console.log('Opening modal for card:', card.dataset.category);
                e.preventDefault();
                e.stopPropagation(); // Prevent event from bubbling to track
                window.openInfraCard(card);
            });
        });

        // Keep track click handler for debugging (but it should not be needed now)
        infraTrack.addEventListener('click', (e) => {
            console.log('Click detected on track, target:', e.target);
            console.log('Target class list:', e.target.classList);
            console.log('Target tag name:', e.target.tagName);
            
            // This should only fire if the click is directly on the track (not on a card)
            if (e.target === infraTrack) {
                console.log('Click on track itself, ignoring');
                return;
            }
            
            // If we get here, it means a click bubbled up from a card but wasn't handled
            console.log('Unexpected click on track - this should not happen');
        });
    }
});
// ...existing code...

// Mobile Navigation Toggle (robust and accessible)
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
if (hamburger && navMenu) {
    // ARIA attributes for accessibility
    hamburger.setAttribute('role', 'button');
    hamburger.setAttribute('aria-label', 'Toggle navigation');
    hamburger.setAttribute('aria-expanded', 'false');
    // Associate the menu (if id missing, give it one)
    if (!navMenu.id) navMenu.id = 'site-nav';
    hamburger.setAttribute('aria-controls', navMenu.id);
    // Ensure initial hidden state on mobile
    if (!navMenu.classList.contains('active')) {
        navMenu.setAttribute('aria-hidden', 'true');
    }

    hamburger.addEventListener('click', (e) => {
        const isActive = hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        // expose state to assistive tech
        hamburger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        navMenu.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        // prevent background scroll when menu open on mobile
        document.body.classList.toggle('menu-open', isActive);
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        navMenu.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('menu-open');
    }));
}

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
        
        // Finish hero image animation after setup
        setTimeout(() => {
            heroImage.style.opacity = '1';
            heroImage.style.transform = 'translateX(0)';
        }, 600);
    }

        // Modal initialization moved to DOMContentLoaded block below

        // Ensure the main image fits fully within the modal (no clipping)
        function sizeModalImageArea() {
            const header = window.infraModal ? window.infraModal.querySelector('.modal-header') : null;
            const main = window.infraModal ? window.infraModal.querySelector('.modal-main') : null;
            const thumbs = window.infraModal ? window.infraModal.querySelector('.modal-thumbnails') : null;
            const galleryImg = window.infraModal ? window.infraModal.querySelector('.modal-gallery img') : null;
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
            window.imageCounter.textContent = `${window.currentImageIndex + 1} / ${window.currentImages.length}`;
        }

        function showImage(index) {
            window.modalGallery.innerHTML = '';
            const img = document.createElement('img');
            img.src = window.currentImages[index].src;
            img.alt = window.currentImages[index].caption;
            // Re-size once the image loads for exact dimensions
            img.addEventListener('load', sizeModalImageArea);
            
            const caption = document.createElement('p');
            caption.textContent = window.currentImages[index].caption;
            caption.className = 'modal-caption';
            
            window.modalGallery.appendChild(img);
            window.modalGallery.appendChild(caption);
            updateImageCounter();
            // Also call sizing to handle quick transitions
            sizeModalImageArea();

            // Sidebar no longer mirrors image caption; keep only on image

            // Update thumbnails
            const thumbnails = window.thumbnailsContainer.querySelectorAll('.thumbnail');
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
            window.thumbnailsContainer.innerHTML = '';
            window.currentImages.forEach((image, index) => {
                const thumbnail = document.createElement('div');
                thumbnail.className = `thumbnail ${index === window.currentImageIndex ? 'active' : ''}`;
                
                const thumbImg = document.createElement('img');
                thumbImg.src = image.src;
                thumbImg.alt = `Thumbnail ${index + 1}`;
                
                thumbnail.appendChild(thumbImg);
                thumbnail.addEventListener('click', () => {
                    window.currentImageIndex = index;
                    showImage(window.currentImageIndex);
                });
                
                window.thumbnailsContainer.appendChild(thumbnail);
            });
        }

        // Modal initialization moved to DOMContentLoaded block below

        // Bind clicks to the whole card plus its main regions
        document.querySelectorAll('.infra-card').forEach(card => {
            // Entire card
            card.style.cursor = 'pointer';
            // Make the card focusable for keyboard users
            if (!card.hasAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            // Keyboard activate
            card.addEventListener('keydown', (ev) => {
                const key = ev.key;
                if (key === 'Enter' || key === ' ') {
                    ev.preventDefault();
                    window.openInfraCard(card);
                }
            });
        });

        // Modal controls moved to DOMContentLoaded block
    
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
// Expose for other modules
window.scrollToTopBtn = scrollToTopBtn;

// Centralized visibility control: hide while any modal is open
window.updateScrollToTopVisibility = function updateScrollToTopVisibility() {
    try {
        if (document.body.classList.contains('modal-open')) {
            scrollToTopBtn.style.display = 'none';
            return;
        }
        scrollToTopBtn.style.display = (window.scrollY > 300) ? 'block' : 'none';
    } catch (_) { /* silent */ }
};

window.addEventListener('scroll', window.updateScrollToTopVisibility);
// Initialize once
window.updateScrollToTopVisibility();

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

// --- Product Carousel Auto-Focus (similar to infra carousel) ---
document.addEventListener('DOMContentLoaded', function() {
    // Find all product carousel tracks
    const productTracks = document.querySelectorAll('.product-carousel-track');
    
    productTracks.forEach(track => {
        const productCards = track.querySelectorAll('.product-card');
        
        // Center align tracks with 5 or fewer products
        if (productCards.length <= 5) {
            track.classList.add('center-aligned');
            const wrapper = track.closest('.product-carousel-wrapper');
            if (wrapper) wrapper.classList.add('center-aligned');
            return; // Skip carousel functionality for 5 or fewer items
        }
        
        let focusIndex = 0;
        let autoFocusInterval = null;
        let isPaused = false;
        let resumeTimeout = null;
        
        function setProductFocus(idx, opts = {}) {
            const doScroll = opts.scroll !== false;
            productCards.forEach((card, i) => {
                // Remove focus class from all cards to keep them all visible
                card.classList.remove('product-card-focus');
                
                if (i === idx) {
                    // Only add subtle focus indicator, no blur effects
                    card.classList.add('product-card-focus');
                    if (doScroll) {
                        const productSection = track.closest('.product-category');
                        if (productSection) {
                            const rect = productSection.getBoundingClientRect();
                            const inView = rect.top < window.innerHeight && rect.bottom > 0;
                            const dragging = track.classList.contains('dragging');
                            if (inView && track && !dragging) {
                                const trackRect = track.getBoundingClientRect();
                                const cardRect = card.getBoundingClientRect();
                                const delta = (cardRect.left + cardRect.right) / 2 - (trackRect.left + trackRect.right) / 2;
                                let target = track.scrollLeft + delta;
                                const styles = getComputedStyle(track);
                                const padLeft = parseFloat(styles.paddingLeft) || 0;
                                const padRight = parseFloat(styles.paddingRight) || 0;
                                const safe = 24;
                                const maxScroll = track.scrollWidth - track.clientWidth;
                                const minTarget = 0 - padLeft - safe;
                                const maxTarget = maxScroll + padRight + safe;
                                target = Math.max(minTarget, Math.min(maxTarget, target));
                                const by = target - track.scrollLeft;
                                track.scrollBy({ left: by, behavior: 'smooth' });
                            }
                        }
                    }
                }
            });
            focusIndex = idx;
        }
        
        function startProductAutoFocus() {
            if (autoFocusInterval) clearInterval(autoFocusInterval);
            autoFocusInterval = setInterval(() => {
                const productSection = track.closest('.product-category');
                const rect = productSection ? productSection.getBoundingClientRect() : null;
                const inView = rect && rect.top < window.innerHeight && rect.bottom > 0;
                if (!isPaused && inView && productCards.length) {
                    const nextIdx = (focusIndex + 1) % productCards.length;
                    setProductFocus(nextIdx, { scroll: true });
                }
            }, 1800); // Slightly slower than infra carousel
        }
        
        // Initial focus without scrolling
        setProductFocus(focusIndex, { scroll: false });
        
        // Start/pause when the section enters/leaves viewport
        let hasStartedOnView = false;
        const productSectionEl = track.closest('.product-category');
        if (productSectionEl) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        isPaused = false;
                        if (!autoFocusInterval) startProductAutoFocus();
                        if (!hasStartedOnView && productCards.length) {
                            hasStartedOnView = true;
                            setTimeout(() => setProductFocus((focusIndex + 1) % productCards.length, { scroll: true }), 150);
                        }
                    } else {
                        isPaused = true;
                    }
                });
            }, { threshold: 0.15 });
            io.observe(productSectionEl);
        }
        
        // Pause autoplay when hovering over the track
        if (track) {
            track.addEventListener('mouseenter', () => {
                isPaused = true;
                if (autoFocusInterval) {
                    clearInterval(autoFocusInterval);
                    autoFocusInterval = null;
                }
            });
            track.addEventListener('mouseleave', () => {
                isPaused = false;
                startProductAutoFocus();
            });
            track.addEventListener('focusin', () => { isPaused = true; });
            track.addEventListener('focusout', (e) => {
                const next = e.relatedTarget;
                if (!next || !track.contains(next)) {
                    isPaused = false;
                    startProductAutoFocus();
                }
            });
        }
        
        // Card-level hover: focus the hovered card without scrolling
        productCards.forEach((card, idx) => {
            card.addEventListener('mouseenter', function() {
                isPaused = true;
                setProductFocus(idx, { scroll: false });
            });
            card.addEventListener('mouseleave', function(e) {
                if (track && e.relatedTarget && track.contains(e.relatedTarget)) {
                    return;
                }
            });
        });

        // Add left/right nav buttons when there are 6 or more product cards
        // Buttons are injected into the `.product-carousel-wrapper` and use smooth scroll
        try {
            const wrapper = track.closest('.product-carousel-wrapper');
            if (wrapper && productCards.length >= 6) {
                // Create buttons
                const prev = document.createElement('button');
                prev.type = 'button';
                prev.className = 'product-prev product-carousel-arrow';
                prev.setAttribute('aria-label', 'Scroll left');
                prev.innerHTML = '&#x2039;'; // single left angle

                const next = document.createElement('button');
                next.type = 'button';
                next.className = 'product-next product-carousel-arrow';
                next.setAttribute('aria-label', 'Scroll right');
                next.innerHTML = '&#x203A;'; // single right angle

                // Insert buttons into wrapper
                wrapper.appendChild(prev);
                wrapper.appendChild(next);

                // Determine sensible scroll amount: visible width * 0.72 or card width + gap
                function getScrollAmount() {
                    const card = productCards[0];
                    if (!card) return Math.floor(track.clientWidth * 0.7);
                    const styles = getComputedStyle(track);
                    const gap = parseFloat(styles.gap || styles.columnGap || '12') || 12;
                    const cardW = Math.ceil(card.getBoundingClientRect().width + gap);
                    // prefer card width if several visible, else use 70% of viewport
                    return Math.max(cardW, Math.floor(track.clientWidth * 0.6));
                }

                // Click handlers
                prev.addEventListener('click', (e) => {
                    e.preventDefault();
                    // pause auto focus briefly
                    isPaused = true;
                    if (autoFocusInterval) { clearInterval(autoFocusInterval); autoFocusInterval = null; }
                    const amt = getScrollAmount();
                    track.scrollBy({ left: -amt, behavior: 'smooth' });
                    setTimeout(() => { isPaused = false; startProductAutoFocus(); }, 1200);
                });

                next.addEventListener('click', (e) => {
                    e.preventDefault();
                    isPaused = true;
                    if (autoFocusInterval) { clearInterval(autoFocusInterval); autoFocusInterval = null; }
                    const amt = getScrollAmount();
                    track.scrollBy({ left: amt, behavior: 'smooth' });
                    setTimeout(() => { isPaused = false; startProductAutoFocus(); }, 1200);
                });

                // Keyboard support: allow arrow keys when wrapper is focused
                // Make wrapper focusable so keyboard users can use ArrowLeft/ArrowRight
                wrapper.setAttribute('tabindex', '0');
                wrapper.addEventListener('keydown', (ev) => {
                    if (ev.key === 'ArrowLeft') { prev.click(); }
                    if (ev.key === 'ArrowRight') { next.click(); }
                });

                // Update buttons visibility on resize (hide if track not overflowing)
                function updateProductButtons() {
                    const overflowing = track.scrollWidth > track.clientWidth + 2;
                    prev.style.display = overflowing ? 'inline-flex' : 'none';
                    next.style.display = overflowing ? 'inline-flex' : 'none';
                }
                updateProductButtons();
                window.addEventListener('resize', updateProductButtons);
            }
        } catch (err) {
            // safe fail
            console.error('Failed to add product carousel arrows', err);
        }
    });
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

// Quote modal: open a quote form with category/machine options sourced from infrastructureData and submit via mailto
document.addEventListener('DOMContentLoaded', function() {
    const getQuoteBtn = document.getElementById('getQuoteBtn');
    const quoteModal = document.getElementById('quoteModal');
    const modalClose = quoteModal ? quoteModal.querySelector('.modal-close') : null;
    const form = document.getElementById('quote-form');
    const statusEl = document.getElementById('q-status');
    const categorySel = document.getElementById('q-category');
    const machineSel = document.getElementById('q-machine');
    const cancelBtn = document.getElementById('q-cancel');

    if (!getQuoteBtn || !quoteModal || !form || !categorySel || !machineSel) return;

    // Build category options based on infrastructureData keys used on homepage cards
    const categoryMap = {
        'sheet-metal': 'Sheet Metal Fabrication',
        'complex-machines': 'CNC and Multi-Axis Machining',
        'welding': 'Robotic and Specialized Welding',
        'tubular': 'Tubular Fabrication Facilities',
        'infrastructure': 'Supporting Facilities and Processes',
        'others': 'Quality & Assembly Equipment'
    };

    function populateCategories() {
        // Clear dynamic options
        Array.from(categorySel.options).slice(1).forEach(o => o.remove());
        Object.keys(categoryMap).forEach(key => {
            if (infrastructureData[key]) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = categoryMap[key];
                categorySel.appendChild(opt);
            }
        });
    }

    function populateMachines(catKey) {
        machineSel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = 'Select a machine';
        machineSel.appendChild(placeholder);

        const data = infrastructureData[catKey];
        if (!data) {
            machineSel.disabled = true;
            return;
        }
        // Take captions from images as machine names
        const names = (data.images || []).map(img => img.caption).filter(Boolean);
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            machineSel.appendChild(opt);
        });
        machineSel.disabled = names.length === 0;
    }

    function openQuoteModal() {
        populateCategories();
        machineSel.disabled = true;
        quoteModal.style.display = 'block';
        quoteModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        // focus first field
        const nameInput = document.getElementById('q-name');
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
    }

    function closeQuoteModal() {
        quoteModal.style.display = 'none';
        quoteModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        statusEl && (statusEl.textContent = '');
        form.reset();
        machineSel.disabled = true;
    }

    getQuoteBtn.addEventListener('click', (e) => {
        // Allow hash link smooth scroll default handler to run, but still open modal
        e.preventDefault();
        openQuoteModal();
    });
    modalClose && modalClose.addEventListener('click', closeQuoteModal);
    cancelBtn && cancelBtn.addEventListener('click', closeQuoteModal);
    quoteModal.addEventListener('click', (e) => { if (e.target === quoteModal) closeQuoteModal(); });
    document.addEventListener('keydown', (e) => {
        if (quoteModal.style.display === 'block' && e.key === 'Escape') closeQuoteModal();
    });

    categorySel.addEventListener('change', () => {
        populateMachines(categorySel.value);
    });

    function buildMailtoLink(payload) {
        const to = 'sales@enray.co.in';
        const subject = encodeURIComponent(`Quote Request: ${payload.categoryLabel} - ${payload.machine || 'General'}`);
        const lines = [
            `Name: ${payload.name}`,
            `Email: ${payload.email}`,
            payload.phone ? `Phone: ${payload.phone}` : null,
            payload.company ? `Company: ${payload.company}` : null,
            `Category: ${payload.categoryLabel}`,
            payload.machine ? `Machine: ${payload.machine}` : null,
            '',
            'Requirements:',
            payload.message || '(none)'
        ].filter(Boolean);
        const body = encodeURIComponent(lines.join('\n'));
        return `mailto:${to}?subject=${subject}&body=${body}`;
    }

    function validateQuoteForm() {
        let ok = true;
        const requiredIds = ['q-name','q-email','q-category','q-machine'];
        requiredIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const val = (el.value || '').trim();
            const isValid = !!val && (id !== 'q-email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val));
            el.classList.toggle('error', !isValid);
            ok = ok && isValid;
        });
        return ok;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        statusEl.textContent = '';
        if (!validateQuoteForm()) {
            statusEl.textContent = 'Please complete the required fields.';
            return;
        }
        const catKey = categorySel.value;
        const payload = {
            name: document.getElementById('q-name').value.trim(),
            email: document.getElementById('q-email').value.trim(),
            phone: document.getElementById('q-phone').value.trim(),
            company: document.getElementById('q-company').value.trim(),
            category: catKey,
            categoryLabel: categoryMap[catKey] || catKey,
            machine: machineSel.value,
            message: document.getElementById('q-message').value.trim()
        };
        const mailto = buildMailtoLink(payload);
        // Try to open user's email client
        window.location.href = mailto;
        statusEl.textContent = 'Opening your email client...';
        // Keep modal open briefly in case client fails to open
        setTimeout(() => {
            statusEl.textContent = 'If your email app did not open, please email us directly at sales@enray.co.in.';
        }, 1500);
    });

});

    // --- Merged slideshow.js (moved from separate file) ---
    document.addEventListener('DOMContentLoaded', function () {
        const slideshow = document.querySelector('.slideshow');
        if (!slideshow) return;

        const track = slideshow.querySelector('.slideshow-track');
        const slides = Array.from(track.querySelectorAll('img'));
        const prevBtn = slideshow.querySelector('.slideshow-prev');
        const nextBtn = slideshow.querySelector('.slideshow-next');
        const dotsWrap = slideshow.querySelector('.slideshow-dots');

        // Normalize any server-side markup using `is-active` so the script
        // consistently uses the `active` class. Then pick the initial index.
        slides.forEach(s => s.classList.remove('is-active'));
        let idx = slides.findIndex(s => s.classList.contains('active'));
        if (idx < 0) idx = 0;
        const total = slides.length;
        let timer = null;
        const interval = 3000; // 3.0s - slowed down per feedback
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // create dots
        function createDots() {
            dotsWrap.innerHTML = '';
            slides.forEach((s, i) => {
                const btn = document.createElement('button');
                btn.className = i === idx ? 'active' : '';
                btn.setAttribute('aria-label', `Show image ${i + 1} of ${total}`);
                btn.addEventListener('click', () => { goTo(i); restart(); });
                dotsWrap.appendChild(btn);
            });
        }

        function updateActive() {
            // slide the track
            track.style.transform = `translateX(-${idx * 100}%)`;
            const dots = Array.from(dotsWrap.children || []);
            dots.forEach((d, i) => d.classList.toggle('active', i === idx));
            // mark the active slide for subtle scale/brightness effect
            slides.forEach((s, i) => s.classList.toggle('active', i === idx));
        }

        function goTo(i) {
            idx = (i + total) % total;
            updateActive();
        }

        function next() { goTo(idx + 1); }
        function prev() { goTo(idx - 1); }

        function start() {
            if (prefersReduced) return;
            stop();
            timer = setInterval(next, interval);
        }
        function stop() { if (timer) { clearInterval(timer); timer = null; } }
        function restart() { stop(); start(); }

        prevBtn && prevBtn.addEventListener('click', (e) => { e.preventDefault(); prev(); restart(); });
        nextBtn && nextBtn.addEventListener('click', (e) => { e.preventDefault(); next(); restart(); });

        slideshow.addEventListener('mouseenter', stop);
        slideshow.addEventListener('mouseleave', start);
        slideshow.addEventListener('focusin', stop);
        slideshow.addEventListener('focusout', start);

        // Also pause when the pointer is directly over an image element
        // or when an image receives focus (keyboard users). This ensures
        // that hovering the image itself (not just the container) pauses
        // autoplay across different browsers and input methods.
        slides.forEach(img => {
            img.addEventListener('mouseenter', stop);
            img.addEventListener('mouseleave', start);
            img.addEventListener('focusin', stop);
            img.addEventListener('focusout', start);
            img.addEventListener('touchstart', stop, { passive: true });
            img.addEventListener('touchend', start, { passive: true });
        });

        // keyboard support
        slideshow.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') { prev(); restart(); }
            if (e.key === 'ArrowRight') { next(); restart(); }
        });

        // Initialize
        createDots();
        // Ensure track starts at the correct position even before images load
        track.style.transform = `translateX(-${idx * 100}%)`;
        updateActive();
        start();
        // Do not auto-nudge the slideshow on init. The regular interval
        // will advance slides after `interval` ms. Removing the early nudge
        // prevents skipping the first slides on page load.
    });

// Hide browser status-bar style URL preview for local .html links
// Approach: for anchors that point to local .html files we remove the `href`
// (so browsers don't show the destination on hover) and store the URL in
// `data-href`. We then add accessible keyboard + click handlers that perform
// navigation. External links, mailto:, tel:, and fragment anchors (#...) are
// left untouched.
document.addEventListener('DOMContentLoaded', function() {
    try {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        anchors.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;

            // Skip external and special links
            const lower = href.trim().toLowerCase();
            if (lower.startsWith('http:') || lower.startsWith('https:') || lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('javascript:') || lower.startsWith('#')) {
                return;
            }

            // Only target simple local HTML files (e.g. about.html, products.html)
            if (!/\.html?(?:[?#]|$)/i.test(href)) return;

            // Store destination and remove href so browser won't show it on hover
            a.setAttribute('data-href', href);
            a.removeAttribute('href');

            // Keep a pointer cursor and preserve visual affordance
            a.classList.add('no-status-url');
            a.setAttribute('role', a.getAttribute('role') || 'link');
            if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '0');

            function navigate() {
                const dest = a.getAttribute('data-href');
                if (!dest) return;
                // Use location.assign so history behaves like a normal link
                window.location.assign(dest);
            }

            a.addEventListener('click', function (e) {
                e.preventDefault();
                navigate();
            });

            a.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate();
                }
            });
        });

        // Inject a tiny style so these elements still show a pointer
        const style = document.createElement('style');
        style.textContent = '.no-status-url { cursor: pointer; }';
        document.head.appendChild(style);
    } catch (err) {
        // fail silently - nothing catastrophic if this doesn't run
        console.error('hide-status-url init failed', err);
    }
});
