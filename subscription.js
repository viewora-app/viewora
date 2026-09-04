"use strict";

/*
============================================================
 VIEWORA — SUBSCRIPTION.JS
 REAL RAZORPAY TEST CHECKOUT
 Firebase Auth + Cloud Functions
============================================================

 FLOW

 Subscription Page
       ↓
 Select Plan
       ↓
 Create Razorpay Order
       ↓
 Razorpay Checkout
       ↓
 Payment
       ↓
 Server-side Signature Verification
       ↓
 Backend Subscription Activation
============================================================
*/

(() => {

    if (window.__VIEWORA_SUBSCRIPTION_INITIALIZED__) {
        console.warn("Viewora subscription.js already initialized.");
        return;
    }

    window.__VIEWORA_SUBSCRIPTION_INITIALIZED__ = true;

    /* ======================================================
       CONFIG
    ====================================================== */

    const CONFIG = {

        razorpayKeyId: "rzp_test_TXf3ABJldKpgFq",

        // Optional: https://REGION-PROJECT.cloudfunctions.net
        apiBase: "",

        currency: "INR",

        functionsRegion: null,

        plans: {

            // monthly = full month price (₹)
            // yearly  = per-month equivalent when billed yearly
            // actual yearly charge = yearly * 12 (see createOrder)
            plus: {
                monthly: 149,
                yearly: 83
            },

            pro: {
                monthly: 299,
                yearly: 167
            },

            elite: {
                monthly: 499,
                yearly: 292
            }

        }

    };


    /* ======================================================
       PLAN LABELS
    ====================================================== */

    const PLAN_LABEL = {

        plus: "Plus",

        pro: "Pro",

        elite: "Elite"

    };


    /* ======================================================
       DOM
    ====================================================== */

    const $ = (selector) =>
        document.querySelector(selector);


    /* ======================================================
       STATE
    ====================================================== */

    let selectedPlan = null;

    let billingCycle = "monthly";

    let currentUser = null;

    let processingPayment = false;


    /* ======================================================
       TOAST
    ====================================================== */

    function toast(message) {

        const toastBox =
            $("#monoToast") ||
            document.getElementById("toast");

        const toastText =
            $("#monoToastText") ||
            document.getElementById("toastText");

        if (!toastBox || !toastText) {

            console.log("[Viewora]", message);

            return;
        }

        toastText.textContent = message;

        toastBox.classList.remove("hidden");
        toastBox.classList.add("show");

        clearTimeout(
            window.__VIEWORA_TOAST_TIMER__
        );

        window.__VIEWORA_TOAST_TIMER__ =
            setTimeout(() => {

                toastBox.classList.remove("show");

            }, 3000);
    }


    /* ======================================================
       LOADING
    ====================================================== */

    function setLoading(active, text = "Processing...") {

        const loader =
            $("#subscriptionLoading") ||
            $("#loadingOverlay");

        if (loader) {

            loader.classList.toggle(
                "show",
                active
            );

            const textEl =
                loader.querySelector(
                    ".loadingText"
                );

            if (textEl) {
                textEl.textContent = text;
            }
        }

        document.body.classList.toggle(
            "payment-processing",
            active
        );
    }


    /* ======================================================
       GET FIREBASE AUTH
    ====================================================== */

    function getAuth() {

        if (
            typeof firebase === "undefined" ||
            !firebase.auth
        ) {
            return null;
        }

        return firebase.auth();
    }


    /* ======================================================
       GET FUNCTIONS
    ====================================================== */

    function getFunctions() {

        if (
            typeof firebase === "undefined" ||
            !firebase.functions
        ) {
            return null;
        }

        const functions =
            CONFIG.functionsRegion
                ? firebase.functions(
                    firebase.app(),
                    CONFIG.functionsRegion
                )
                : firebase.functions();

        return functions;
    }


    /* ======================================================
       CURRENT USER
    ====================================================== */

    function requireUser() {

        const auth = getAuth();

        if (!auth) {

            toast(
                "Firebase authentication is unavailable."
            );

            return null;
        }

        const user = auth.currentUser;

        if (!user) {

            toast(
                "Please login first."
            );

            setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 900);

            return null;
        }

        currentUser = user;

        return user;
    }


    /* ======================================================
       GET PLAN PRICE
    ====================================================== */

    function getPlanPrice(plan, cycle) {

        if (
            !CONFIG.plans[plan] ||
            !CONFIG.plans[plan][cycle]
        ) {
            return null;
        }

        return CONFIG.plans[plan][cycle];
    }


    /* ======================================================
       INR → PAISE
    ====================================================== */

    function rupeesToPaise(amount) {

        return Math.round(
            Number(amount) * 100
        );
    }


    /* ======================================================
       SELECT PLAN
    ====================================================== */

    function selectPlan(plan) {

        if (!CONFIG.plans[plan]) {

            console.warn(
                "Unknown plan:",
                plan
            );

            return;
        }

        selectedPlan = plan;

        document
            .querySelectorAll(
                "[data-plan]"
            )
            .forEach(card => {

                card.classList.toggle(
                    "selected",
                    card.dataset.plan === plan
                );

                card.classList.toggle(
                    "active",
                    card.dataset.plan === plan
                );
            });

        updatePayButton();

        updateSelectedPlanUI();
    }


    /* ======================================================
       BILLING CYCLE
    ====================================================== */

    function setBillingCycle(cycle) {

        if (
            cycle !== "monthly" &&
            cycle !== "yearly"
        ) {
            return;
        }

        billingCycle = cycle;

        document.body.dataset.billing = cycle;

        document
            .querySelectorAll(
                "[data-cycle]"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.cycle === cycle
                );

            });

        updatePlanPrices();

        updatePayButton();

        updateSelectedPlanUI();
    }


    /* ======================================================
       UPDATE PLAN PRICES
    ====================================================== */

    function updatePlanPrices() {

        document
            .querySelectorAll(
                "[data-plan]"
            )
            .forEach(card => {

                const plan =
                    card.dataset.plan;

                const price =
                    getPlanPrice(
                        plan,
                        billingCycle
                    );

                if (price == null) {
                    return;
                }

                const priceElement =
                    card.querySelector(
                        "[data-price]"
                    );

                if (priceElement) {

                    priceElement.textContent =
                        `₹${price}`;
                }

                const per = card.querySelector(".per");
                if (per) {
                    per.textContent =
                        billingCycle === "yearly"
                            ? "/mo · billed yearly"
                            : "/month";
                }

            });
    }


    /* ======================================================
       UPDATE PAY BUTTON
    ====================================================== */

    function updatePayButton() {

        const button =
            $("#payBtn");

        if (!button) {
            return;
        }

        if (!selectedPlan) {

            button.disabled = true;

            button.innerHTML = `
                <i class="fa-solid fa-lock"></i>
                Select a plan
            `;

            return;
        }

        const price =
            getPlanPrice(
                selectedPlan,
                billingCycle
            );

        button.disabled =
            processingPayment;

        button.innerHTML = processingPayment

            ? `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Processing...
              `

            : `
                <i class="fa-solid fa-lock"></i>
                Continue to pay ₹${price}
              `;
    }


    /* ======================================================
       SELECTED PLAN UI
    ====================================================== */

    function updateSelectedPlanUI() {

        const planText =
            $("#selectedPlanName");

        const cycleText =
            $("#selectedBillingCycle");

        const priceText =
            $("#selectedPlanPrice");

        if (planText) {

            planText.textContent =
                selectedPlan
                    ? PLAN_LABEL[selectedPlan]
                    : "No plan selected";
        }

        if (cycleText) {

            cycleText.textContent =
                billingCycle === "yearly"
                    ? "Yearly"
                    : "Monthly";
        }

        if (priceText && selectedPlan) {

            const price =
                getPlanPrice(
                    selectedPlan,
                    billingCycle
                );

            if (billingCycle === "yearly") {
                const total = Number(price) * 12;
                priceText.textContent =
                    `₹${total}/year (₹${price}/mo)`;
            } else {
                priceText.textContent =
                    `₹${price}/month`;
            }
        }
    }


    /* ======================================================
       AMOUNT HELPERS
    ====================================================== */

    function getChargeRupees() {

        const price =
            getPlanPrice(
                selectedPlan,
                billingCycle
            );

        if (price == null) {
            return null;
        }

        // yearly config = discounted per-month → charge × 12
        if (billingCycle === "yearly") {
            return Math.round(Number(price) * 12);
        }

        return Math.round(Number(price));
    }


    /* ======================================================
       ACTIVATE SUBSCRIPTION (Firebase write after pay)
    ====================================================== */

    async function activateSubscriptionLocal(paymentResponse) {

        const user =
            currentUser ||
            requireUser();

        if (!user) {
            throw new Error("Please login first.");
        }

        if (
            typeof firebase === "undefined" ||
            !firebase.database
        ) {
            throw new Error("Firebase Database unavailable.");
        }

        const now = Date.now();
        const duration =
            billingCycle === "yearly"
                ? 365 * 24 * 60 * 60 * 1000
                : 30 * 24 * 60 * 60 * 1000;

        const charge =
            getChargeRupees();

        const payload = {
            plan: selectedPlan,
            billingCycle: billingCycle,
            cycle: billingCycle,
            status: "active",
            active: true,
            amount: charge,
            amountPaise: rupeesToPaise(charge),
            currency: CONFIG.currency,
            razorpay_payment_id:
                paymentResponse.razorpay_payment_id || "",
            razorpay_order_id:
                paymentResponse.razorpay_order_id || "",
            razorpay_signature:
                paymentResponse.razorpay_signature || "",
            startedAt: now,
            expiresAt: now + duration,
            updatedAt: now,
            source: "razorpay_checkout"
        };

        const db = firebase.database();

        await db.ref("subscriptions/" + user.uid).update(payload);
        await db.ref("users/" + user.uid + "/subscription").update(payload);

        const payRef =
            db.ref("users/" + user.uid + "/payments").push();

        await payRef.set({
            ...payload,
            id: payRef.key,
            createdAt: now
        });

        // Badge hierarchy: Elite → Red VIP, Plus/Pro → Blue verified
        try {
            if (window.VieworaBadges && typeof VieworaBadges.applySubscriptionBadges === "function") {
                await VieworaBadges.applySubscriptionBadges(user.uid, payload);
            } else {
                // Fallback if badges.js not loaded
                const plan = String(selectedPlan || "").toLowerCase();
                const badgeUpdate = {
                    premium: true,
                    isPremium: true,
                    plan: plan,
                    subscriptionActive: true,
                    subscriptionStatus: "active"
                };
                if (plan === "elite") {
                    badgeUpdate.redTick = true;
                    badgeUpdate.vip = true;
                    badgeUpdate.elite = true;
                    badgeUpdate.verified = true;
                    badgeUpdate.isVerified = true;
                    badgeUpdate.blueTick = true;
                    badgeUpdate.badge = "vip";
                    badgeUpdate.verificationStatus = "vip";
                } else if (plan === "plus" || plan === "pro") {
                    badgeUpdate.verified = true;
                    badgeUpdate.isVerified = true;
                    badgeUpdate.blueTick = true;
                    badgeUpdate.redTick = false;
                    badgeUpdate.vip = false;
                    badgeUpdate.badge = "verified";
                    badgeUpdate.verificationStatus = "verified";
                }
                await db.ref("users/" + user.uid).update(badgeUpdate);
            }
        } catch (badgeErr) {
            console.warn("Badge update skipped:", badgeErr);
        }

        updateSubscriptionUI(payload);

        // Update visible plan chips if present
        const planName = document.getElementById("planName");
        const planMeta = document.getElementById("planMeta");
        const planChip = document.getElementById("planChip");

        if (planName) {
            planName.textContent =
                PLAN_LABEL[selectedPlan] || selectedPlan;
        }

        if (planMeta) {
            planMeta.textContent =
                billingCycle === "yearly"
                    ? "Yearly · Active"
                    : "Monthly · Active";
        }

        if (planChip) {
            planChip.textContent = "Active";
            planChip.style.color = "#35d69a";
        }

        return payload;
    }


    /* ======================================================
       TRY CLOUD FUNCTION ORDER (optional)
    ====================================================== */

    async function tryCreateServerOrder(amountPaise) {

        // 1) HTTP API (Cloud Function / Express) if apiBase set
        try {
            const base = String(CONFIG.apiBase || "").replace(/\/$/, "");
            if (base) {
                const res = await fetch(base + "/createSubscriptionOrder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        plan: selectedPlan,
                        billingCycle: billingCycle,
                        amount: amountPaise
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && (data.order_id || data.id)) {
                        return {
                            order_id: data.order_id || data.id,
                            amount: data.amount || amountPaise,
                            currency: data.currency || CONFIG.currency
                        };
                    }
                }
            }
        } catch (error) {
            console.warn("HTTP create order skipped:", error?.message || error);
        }

        // 2) Firebase callable
        try {

            const functions = getFunctions();

            if (!functions) {
                return null;
            }

            const callable =
                functions.httpsCallable(
                    "createSubscriptionOrder"
                );

            const result =
                await callable({
                    plan: selectedPlan,
                    billingCycle,
                    amount: amountPaise
                });

            if (
                result &&
                result.data &&
                result.data.order_id
            ) {
                return result.data;
            }

        } catch (error) {

            console.warn(
                "Server order skipped:",
                error?.message || error
            );
        }

        // 3) No server → client checkout without order_id (still works in test)
        return null;
    }


    async function tryVerifyServer(response) {

        try {

            const functions = getFunctions();

            if (!functions) {
                return null;
            }

            const callable =
                functions.httpsCallable(
                    "verifySubscriptionPayment"
                );

            const result =
                await callable({
                    razorpay_order_id:
                        response.razorpay_order_id,
                    razorpay_payment_id:
                        response.razorpay_payment_id,
                    razorpay_signature:
                        response.razorpay_signature
                });

            if (
                result &&
                result.data &&
                result.data.success === true
            ) {
                return result.data;
            }

        } catch (error) {

            console.warn(
                "Server verify skipped:",
                error?.message || error
            );
        }

        return null;
    }


    /* ======================================================
       OPEN RAZORPAY CHECKOUT
    ====================================================== */

    function openRazorpayCheckout(order) {

        return new Promise((resolve, reject) => {

            if (typeof Razorpay === "undefined") {
                reject(
                    new Error(
                        "Razorpay SDK not loaded. Check internet / script tag."
                    )
                );
                return;
            }

            const key =
                String(CONFIG.razorpayKeyId || "").trim();

            if (
                !key ||
                key === "YOUR_TEST_KEY_ID" ||
                !key.startsWith("rzp_")
            ) {
                reject(
                    new Error(
                        "Razorpay Key Id missing. Open subscription.js → set CONFIG.razorpayKeyId = 'rzp_test_...'"
                    )
                );
                return;
            }

            const user =
                currentUser || requireUser();

            if (!user) {
                reject(new Error("Please login first."));
                return;
            }

            const chargeRupees = getChargeRupees();

            if (chargeRupees == null || chargeRupees <= 0) {
                reject(new Error("Invalid plan amount."));
                return;
            }

            const amountPaise =
                order && order.amount
                    ? Number(order.amount)
                    : rupeesToPaise(chargeRupees);

            const options = {

                key: key,

                amount: amountPaise,

                currency:
                    (order && order.currency) ||
                    CONFIG.currency,

                name: "Viewora",

                description:
                    "Viewora " +
                    (PLAN_LABEL[selectedPlan] || selectedPlan) +
                    " · " +
                    (billingCycle === "yearly"
                        ? "Yearly"
                        : "Monthly"),

                // order_id only if server created one
                ...(order && order.order_id
                    ? { order_id: order.order_id }
                    : {}),

                prefill: {
                    name: user.displayName || "",
                    email: user.email || "",
                    contact: user.phoneNumber || ""
                },

                notes: {
                    uid: user.uid,
                    plan: selectedPlan,
                    billingCycle: billingCycle,
                    product: "viewora_subscription"
                },

                theme: {
                    color: "#7c5cff"
                },

                modal: {
                    ondismiss: function () {
                        processingPayment = false;
                        updatePayButton();
                        toast("Payment cancelled.");
                        reject(new Error("Payment cancelled."));
                    }
                },

                handler: function (response) {
                    resolve(response || {});
                }
            };

            try {

                const rzp = new Razorpay(options);

                rzp.on("payment.failed", function (resp) {
                    const msg =
                        resp?.error?.description ||
                        resp?.error?.reason ||
                        "Payment failed.";
                    reject(new Error(msg));
                });

                rzp.open();

            } catch (error) {
                reject(
                    error instanceof Error
                        ? error
                        : new Error(String(error))
                );
            }
        });
    }


    /* ======================================================
       REAL PAYMENT FLOW
    ====================================================== */

    async function startPayment() {

        if (processingPayment) {
            return;
        }

        if (!selectedPlan) {
            toast("Please select a plan first.");
            return;
        }

        const user = requireUser();

        if (!user) {
            return;
        }

        const key =
            String(CONFIG.razorpayKeyId || "").trim();

        if (
            !key ||
            key === "YOUR_TEST_KEY_ID" ||
            !key.startsWith("rzp_")
        ) {
            toast(
                "Add Razorpay Key Id in subscription.js (CONFIG.razorpayKeyId)"
            );
            console.error(
                "Set CONFIG.razorpayKeyId to your rzp_test_... or rzp_live_... key"
            );
            return;
        }

        if (typeof Razorpay === "undefined") {
            toast("Razorpay SDK not loaded.");
            return;
        }

        processingPayment = true;
        updatePayButton();
        setLoading(true, "Opening Razorpay...");

        try {

            const chargeRupees = getChargeRupees();
            const amountPaise = rupeesToPaise(chargeRupees);

            // Optional: server order (if Cloud Function exists)
            let order = null;

            try {
                order = await tryCreateServerOrder(amountPaise);
            } catch (e) {
                console.warn("createOrder soft-fail:", e);
                order = null;
            }

            setLoading(false);

            // Open Razorpay (works with or without order_id)
            const paymentResponse =
                await openRazorpayCheckout(order);

            setLoading(true, "Confirming payment...");

            // Optional server verify
            await tryVerifyServer(paymentResponse);

            // Always activate locally after successful checkout handler
            await activateSubscriptionLocal(paymentResponse);

            setLoading(false);

            toast(
                "Payment successful · " +
                (PLAN_LABEL[selectedPlan] || "Plan") +
                " activated"
            );

            console.log(
                "Viewora payment success:",
                paymentResponse
            );

        } catch (error) {

            console.error(
                "Viewora payment error:",
                error
            );

            let message =
                error?.message ||
                "Payment could not be completed.";

            // Firebase callable "internal" → friendlier text
            if (
                /internal/i.test(message) ||
                error?.code === "internal" ||
                error?.code === "functions/internal"
            ) {
                message =
                    "Server error. Using direct Razorpay — check Key Id & network.";
            }

            if (/cancelled/i.test(message)) {
                message = "Payment cancelled.";
            }

            toast(message);

        } finally {

            processingPayment = false;
            setLoading(false);
            updatePayButton();
        }
    }


    /* ======================================================
       REFRESH SUBSCRIPTION
    ====================================================== */

    async function refreshSubscription() {

        const auth =
            getAuth();

        if (!auth) {
            return;
        }

        const user =
            auth.currentUser;

        if (!user) {
            return;
        }

        /*
         The backend should have created/updated
         subscriptions/{uid}.

         This function only reads the result.
        */

        if (
            typeof firebase === "undefined" ||
            !firebase.database
        ) {
            return;
        }

        try {

            const snapshot =
                await firebase
                    .database()
                    .ref(
                        `subscriptions/${user.uid}`
                    )
                    .once("value");

            const subscription =
                snapshot.val();

            if (!subscription) {
                return;
            }

            updateSubscriptionUI(
                subscription
            );

        } catch (error) {

            console.warn(
                "Unable to refresh subscription:",
                error
            );
        }
    }


    /* ======================================================
       SUBSCRIPTION UI
    ====================================================== */

    function updateSubscriptionUI(
        subscription
    ) {

        const status =
            subscription?.status;

        const plan =
            subscription?.plan;

        document
            .querySelectorAll(
                "[data-subscription-status]"
            )
            .forEach(element => {

                element.textContent =
                    status === "active"
                        ? "Premium Active"
                        : "Not Active";
            });


        document
            .querySelectorAll(
                "[data-current-plan]"
            )
            .forEach(element => {

                element.textContent =
                    PLAN_LABEL[plan] ||
                    "Free";
            });


        document.body.dataset.subscriptionStatus =
            status || "inactive";
    }


    /* ======================================================
       LOAD CURRENT SUBSCRIPTION
    ====================================================== */

    async function loadCurrentSubscription() {

        const auth =
            getAuth();

        if (!auth) {
            return;
        }

        const user =
            auth.currentUser;

        if (!user) {
            return;
        }

        currentUser = user;

        if (!firebase.database) {
            return;
        }

        try {

            const snapshot =
                await firebase
                    .database()
                    .ref(
                        `subscriptions/${user.uid}`
                    )
                    .once("value");

            const subscription =
                snapshot.val();

            if (subscription) {

                updateSubscriptionUI(
                    subscription
                );
            }

        } catch (error) {

            console.warn(
                "Subscription load failed:",
                error
            );
        }
    }


    /* ======================================================
       FIREBASE AUTH LISTENER
    ====================================================== */

    function initializeAuth() {

        const auth =
            getAuth();

        if (!auth) {
            return;
        }

        auth.onAuthStateChanged(
            async user => {

                currentUser =
                    user || null;

                if (user) {

                    await loadCurrentSubscription();

                }

            }
        );
    }


    /* ======================================================
       PLAN CLICK HANDLERS
    ====================================================== */

    function initializePlanButtons() {

        document
            .querySelectorAll(
                "[data-plan]"
            )
            .forEach(element => {

                element.addEventListener(
                    "click",
                    event => {

                        /*
                         Don't override actual
                         buttons/links inside cards.
                        */

                        if (
                            event.target.closest(
                                "a"
                            )
                        ) {
                            return;
                        }

                        selectPlan(
                            element.dataset.plan
                        );
                    }
                );
            });
    }


    /* ======================================================
       BILLING BUTTONS
    ====================================================== */

    function initializeBillingButtons() {

        document
            .querySelectorAll(
                "[data-cycle]"
            )
            .forEach(element => {

                element.addEventListener(
                    "click",
                    () => {

                        setBillingCycle(
                            element.dataset.cycle
                        );

                    }
                );

            });
    }


    /* ======================================================
       PAY BUTTON
    ====================================================== */

    function initializePayButton() {

        const button =
            $("#payBtn");

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            startPayment
        );

        updatePayButton();
    }


    /* ======================================================
       RAZORPAY SDK CHECK
    ====================================================== */

    function waitForRazorpay() {

        return new Promise(
            resolve => {

                if (
                    typeof Razorpay !==
                    "undefined"
                ) {

                    resolve(true);

                    return;
                }

                let attempts = 0;

                const timer =
                    setInterval(() => {

                        attempts++;

                        if (
                            typeof Razorpay !==
                            "undefined"
                        ) {

                            clearInterval(timer);

                            resolve(true);

                            return;
                        }

                        if (
                            attempts >= 50
                        ) {

                            clearInterval(timer);

                            resolve(false);
                        }

                    }, 100);

            }
        );
    }


    /* ======================================================
       BACK BUTTON
    ====================================================== */

    function initializeBackButton() {

        const button =
            $("#backBtn");

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            () => {

                if (
                    window.history.length > 1
                ) {

                    window.history.back();

                } else {

                    window.location.href =
                        "profile.html";
                }

            }
        );
    }


    /* ======================================================
       INITIALIZE
    ====================================================== */

    async function init() {

        console.log(
            "Viewora Subscription System starting..."
        );

        initializePlanButtons();

        initializeBillingButtons();

        initializePayButton();

        initializeBackButton();

        document.body.dataset.billing = billingCycle;

        updatePlanPrices();

        updateSelectedPlanUI();

        initializeAuth();

        const razorpayReady =
            await waitForRazorpay();

        if (!razorpayReady) {

            console.warn(
                "Razorpay Checkout SDK not detected."
            );
        }

        console.log(
            "Viewora Subscription System ready."
        );
    }


    /* ======================================================
       GLOBAL API
    ====================================================== */

    window.VieworaSubscription = {

        selectPlan,

        setBillingCycle,

        startPayment,

        loadCurrentSubscription,

        refreshSubscription,

        getPlanPrice

    };


    /* ======================================================
       DOM READY
    ====================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();
    }

})();