"use strict";

(() => {
    if (window.__VIEWORA_SPLASH_INITIALIZED__) return;
    window.__VIEWORA_SPLASH_INITIALIZED__ = true;

    const loadingText = document.getElementById("loadingText");
    const loaderFill  = document.querySelector(".loaderFill");
    const loaderGlow  = document.querySelector(".loader-glow");
    const particlesEl = document.getElementById("particles");

    /* =========================================================
       DESTINATION + SECURITY
       ========================================================= */
    const params = new URLSearchParams(window.location.search);
    let nextPage = params.get("next");

    if (
        !nextPage ||
        nextPage.includes("://") ||
        nextPage.startsWith("//") ||
        nextPage.includes("splash.html")
    ) {
        nextPage = "index.html";
    }

    /* =========================================================
       GENERATE PARTICLES
       ========================================================= */
    const PARTICLE_COUNT = 18;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const span = document.createElement("span");
        const size = 2 + Math.random() * 3.5;

        span.style.width  = `${size}px`;
        span.style.height = `${size}px`;
        span.style.left   = `${Math.random() * 100}%`;
        span.style.top    = `${Math.random() * 100}%`;
        span.style.animationDelay    = `${-Math.random() * 8}s`;
        span.style.animationDuration = `${6 + Math.random() * 5}s`;

        particlesEl.appendChild(span);
    }

    /* =========================================================
       LOADING MESSAGES
       ========================================================= */
    const messages = [
        "Initializing...",
        "Preparing Viewora...",
        "Loading your experience...",
        "Almost ready..."
    ];

    let messageIndex = 0;

    const messageTimer = setInterval(() => {
        messageIndex++;
        if (messageIndex < messages.length) {
            loadingText.style.opacity = "0";
            setTimeout(() => {
                loadingText.textContent = messages[messageIndex];
                loadingText.style.opacity = "1";
            }, 180);
        }
    }, 620);

    /* =========================================================
       SMOOTH PROGRESS
       ========================================================= */
    let progress = 0;

    const progressTimer = setInterval(() => {
        // Ease-out style increments
        const remaining = 100 - progress;
        progress += Math.random() * (remaining * 0.18) + 1.2;

        if (progress > 100) progress = 100;

        loaderFill.style.width = `${progress}%`;

        if (loaderGlow) {
            loaderGlow.style.left    = `calc(${progress}% - 20px)`;
            loaderGlow.style.opacity = progress > 5 && progress < 98 ? "1" : "0";
        }

        if (progress >= 100) {
            clearInterval(progressTimer);
        }
    }, 110);

    /* =========================================================
       REDIRECT
       ========================================================= */
    setTimeout(() => {
        clearInterval(messageTimer);
        clearInterval(progressTimer);

        loaderFill.style.width = "100%";
        if (loaderGlow) loaderGlow.style.opacity = "0";

        loadingText.style.opacity = "0";
        setTimeout(() => {
            loadingText.textContent = "Welcome to Viewora";
            loadingText.style.opacity = "1";
        }, 160);

        setTimeout(() => {
            // Soft exit animation
            document.querySelector(".splash").style.transition = "opacity 0.4s ease, transform 0.4s ease";
            document.querySelector(".splash").style.opacity = "0";
            document.querySelector(".splash").style.transform = "scale(1.04)";

            setTimeout(() => {
                window.location.replace(nextPage);
            }, 380);
        }, 420);
    }, 2800);
})();