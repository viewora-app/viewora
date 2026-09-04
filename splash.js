"use strict";

/*
==============================================================
 VIEWORA — SPLASH.JS
 Premium App Launch Controller
 YouTube-style entry behavior

 FEATURES
 --------------------------------------------------------------
 • Splash only acts as an entry screen
 • Does NOT run on every page
 • Prevents splash from browser-history stack
 • Smooth exit animation
 • Handles slow / fast loading safely
 • Prevents double redirect
 • Works with mobile browsers / PWA
==============================================================
*/

(() => {

    /* =========================================================
       PREVENT DOUBLE INITIALIZATION
    ========================================================= */

    if (window.__VIEWORA_SPLASH_INITIALIZED__) {
        return;
    }

    window.__VIEWORA_SPLASH_INITIALIZED__ = true;


    /* =========================================================
       CONFIG
    ========================================================= */

    const CONFIG = {

        /*
         * Main Viewora home page.
         */
        HOME_PAGE: "index.html",

        /*
         * Minimum time the splash remains visible.
         * Keeps the animation smooth instead of flashing.
         */
        MINIMUM_TIME: 1150,

        /*
         * Maximum time before navigation.
         * Prevents splash getting stuck forever.
         */
        MAXIMUM_TIME: 4500,

        /*
         * CSS exit duration.
         */
        EXIT_DURATION: 420,

        /*
         * Session key.
         */
        SESSION_KEY:
            "VIEWORA_SPLASH_SESSION",

        /*
         * Prevent duplicate redirects.
         */
        REDIRECT_KEY:
            "VIEWORA_SPLASH_REDIRECTED"
    };


    /* =========================================================
       DOM
    ========================================================= */

    const splash =
        document.getElementById("splash");


    if (!splash) {

        console.warn(
            "Viewora Splash: #splash element not found."
        );

        return;
    }


    /* =========================================================
       STATE
    ========================================================= */

    let redirectStarted = false;

    const startTime =
        performance.now();


    /* =========================================================
       SESSION CHECK
    ========================================================= */

    /*
     * This session flag is intentionally lightweight.
     *
     * The splash page itself is only supposed to be opened
     * from the app's entry point.
     */

    try {

        sessionStorage.setItem(
            CONFIG.SESSION_KEY,
            "active"
        );

    } catch (error) {

        console.warn(
            "Viewora Splash: sessionStorage unavailable."
        );

    }


    /* =========================================================
       DOCUMENT VISIBILITY
    ========================================================= */

    /*
     * If the user temporarily switches apps while splash
     * is showing, don't restart the animation.
     */

    let pageHidden = false;

    document.addEventListener(
        "visibilitychange",
        () => {

            pageHidden =
                document.visibilityState !== "visible";

        }
    );


    /* =========================================================
       REDIRECT LOCK
    ========================================================= */

    function hasRedirected() {

        try {

            return (
                sessionStorage.getItem(
                    CONFIG.REDIRECT_KEY
                ) === "true"
            );

        } catch {

            return false;
        }
    }


    function setRedirectLock() {

        try {

            sessionStorage.setItem(
                CONFIG.REDIRECT_KEY,
                "true"
            );

        } catch {

            /* Ignore storage errors */
        }
    }


    /* =========================================================
       HOME URL
    ========================================================= */

    function getHomeURL() {

        /*
         * Preserve the current folder.
         *
         * Example:
         *
         * /viewora/splash.html
         *       ↓
         * /viewora/index.html
         */

        return CONFIG.HOME_PAGE;
    }


    /* =========================================================
       REDIRECT
    ========================================================= */

    function redirectToHome() {

        if (redirectStarted) {
            return;
        }

        if (hasRedirected()) {
            return;
        }

        redirectStarted = true;

        setRedirectLock();


        /* -----------------------------------------------------
           Start premium fade-out
        ----------------------------------------------------- */

        splash.classList.add("hide");


        /* -----------------------------------------------------
           Wait for CSS transition
        ----------------------------------------------------- */

        window.setTimeout(() => {

            /*
             * replace() is important.
             *
             * It prevents:
             *
             * splash → index
             *
             * from leaving splash in browser history.
             */

            window.location.replace(
                getHomeURL()
            );

        }, CONFIG.EXIT_DURATION);

    }


    /* =========================================================
       MINIMUM SPLASH TIMER
    ========================================================= */

    function waitForMinimumTime() {

        const elapsed =
            performance.now() - startTime;

        const remaining =
            Math.max(
                0,
                CONFIG.MINIMUM_TIME - elapsed
            );

        return new Promise(resolve => {

            window.setTimeout(
                resolve,
                remaining
            );

        });

    }


    /* =========================================================
       PAGE READY
    ========================================================= */

    async function startSplash() {

        /*
         * Wait until page resources are ready.
         *
         * This prevents a very fast device from showing
         * an unfinished splash frame.
         */

        if (
            document.readyState !==
            "complete"
        ) {

            await new Promise(resolve => {

                window.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                );

            });

        }


        /*
         * Maintain minimum visual duration.
         */

        await waitForMinimumTime();


        /*
         * Don't restart anything when the page was hidden.
         * Continue normally when visible again.
         */

        if (pageHidden) {

            await new Promise(resolve => {

                const checkVisibility = () => {

                    if (
                        document.visibilityState ===
                        "visible"
                    ) {

                        document.removeEventListener(
                            "visibilitychange",
                            checkVisibility
                        );

                        resolve();

                    }

                };

                document.addEventListener(
                    "visibilitychange",
                    checkVisibility
                );

            });

        }


        redirectToHome();

    }


    /* =========================================================
       FAIL-SAFE
    ========================================================= */

    /*
     * If something unexpected prevents the normal flow,
     * never leave the user stuck on the splash forever.
     */

    window.setTimeout(() => {

        if (!redirectStarted) {

            redirectToHome();

        }

    }, CONFIG.MAXIMUM_TIME);


    /* =========================================================
       START
    ========================================================= */

    startSplash();


})();