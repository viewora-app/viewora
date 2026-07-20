// =======================================
// Viewora V3 Navigation
// nav.js
// =======================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    initNavigation();
    initRipple();
    initNetworkStatus();

});

// =======================================
// Navigation
// =======================================

function initNavigation() {

    const nav = document.querySelector(".bottomNav");

    if (!nav) return;

    const links = nav.querySelectorAll("a");

    const current =
        location.pathname.split("/").pop() || "index.html";

    links.forEach(link => {

        const href = link.getAttribute("href");

        link.classList.remove("active");

        if (href === current) {

            link.classList.add("active");

        }

        link.addEventListener("click", function () {

            links.forEach(l => l.classList.remove("active"));

            this.classList.add("active");

            this.animate([
                { transform: "scale(1)" },
                { transform: "scale(.90)" },
                { transform: "scale(1)" }
            ], {
                duration: 180
            });

            if ("vibrate" in navigator) {
                navigator.vibrate(15);
            }

        });

    });

}

// =======================================
// Ripple Effect
// =======================================

function initRipple() {

    const buttons =
        document.querySelectorAll(".bottomNav a");

    buttons.forEach(btn => {

        btn.addEventListener("click", function (e) {

            const ripple =
                document.createElement("span");

            ripple.className = "navRipple";

            const rect =
                this.getBoundingClientRect();

            ripple.style.left =
                (e.clientX - rect.left) + "px";

            ripple.style.top =
                (e.clientY - rect.top) + "px";

            this.appendChild(ripple);

            setTimeout(() => {

                ripple.remove();

            }, 600);

        });

    });

}

// =======================================
// Double Tap Home
// =======================================

let lastTap = 0;

document.addEventListener("click", e => {

    const home =
        e.target.closest('a[href="index.html"]');

    if (!home) return;

    const now = Date.now();

    if (now - lastTap < 300) {

        window.scrollTo({

            top: 0,
            behavior: "smooth"

        });

    }

    lastTap = now;

});

// =======================================
// Network Status
// =======================================

function initNetworkStatus() {

    window.addEventListener("offline", () => {

        console.log("📴 Offline");

        const box =
            document.getElementById("networkStatus");

        if (box)
            box.classList.remove("hidden");

    });

    window.addEventListener("online", () => {

        console.log("🌐 Online");

        const box =
            document.getElementById("networkStatus");

        if (box)
            box.classList.add("hidden");

    });

}

// =======================================
// Helper
// =======================================

window.go = function (page) {

    location.href = page;

};

// =======================================

console.log("✅ Viewora Navigation Loaded");