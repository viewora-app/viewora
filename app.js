// ==========================================
// VIEWORA APP.JS V4.0
// PART 1
// Authentication + Signup
// ==========================================

let currentUser = null;

// ==========================================
// Auth State
// ==========================================

auth.onAuthStateChanged((user) => {

    if (user) {

        currentUser = user;

    } else {

        currentUser = null;

    }

});

// =====================================
// PREMIUM SIGNUP
// =====================================

window.signup = async function () {

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    if (!name || !email || !password) {
        alert("Please fill all fields.");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }

    try {

        // Create Account
        const result = await auth.createUserWithEmailAndPassword(email, password);

        const user = result.user;

        // Save User Data
        await db.ref("users/" + user.uid).set({

            uid: user.uid,

            name: name,

            username: "@" + name.toLowerCase().replace(/\s+/g, ""),

            email: email,

            bio: "Welcome to Viewora 🚀",

            profilePhoto: "non.jpg",

            verified: false,

            joinedAt: firebase.database.ServerValue.TIMESTAMP

        });

        // Send Verification Email
        await user.sendEmailVerification();

        alert(
`🎉 Account created successfully!

A verification email has been sent to:

${email}

Please verify your email before logging in.`
        );

        // Logout
        await auth.signOut();

        // Go to Login
        window.location.href = "login.html";

    } catch (error) {

        switch (error.code) {

            case "auth/email-already-in-use":
                alert("This email is already registered.");
                break;

            case "auth/invalid-email":
                alert("Invalid email address.");
                break;

            case "auth/weak-password":
                alert("Password is too weak.");
                break;

            default:
                alert(error.message);

        }

    }

};

// ==========================================

console.log("✅ APP V4 Part 1 Loaded");
// ==========================================
// VIEWORA APP.JS V4.0
// PART 2
// Login + Forgot Password + Logout
// ==========================================

// ==========================================
// Login
// ==========================================

window.login = async function () {

    const email =
        document.getElementById("email")?.value.trim();

    const password =
        document.getElementById("password")?.value;

    if (!email || !password) {

        alert("Enter email and password.");
        return;

    }

    try {

        const result =
            await auth.signInWithEmailAndPassword(
                email,
                password
            );

        const user = result.user;

        // Update Database
        await db.ref("users/" + user.uid).update({

            verified: true,
            lastLogin: Date.now()

        });

        location.href = "splash.html";

    }

    catch (error) {

        alert(error.message);

    }

};

// ==========================================
// Forgot Password
// ==========================================

window.forgotPassword = async function () {

    const email = prompt(
        "Enter your registered email"
    );

    if (!email) return;

    try {

        await auth.sendPasswordResetEmail(email);

        alert(
            "Password reset link has been sent to your email."
        );

    }

    catch (error) {

        alert(error.message);

    }

};

// ==========================================
// Resend Verification Email
// ==========================================

window.resendVerification = async function () {

    if (!auth.currentUser) {

        alert("Please login first.");
        return;

    }

    try {

        await auth.currentUser.sendEmailVerification();

        alert("Verification email sent.");

    }

    catch (error) {

        alert(error.message);

    }

};

// ==========================================
// Logout
// ==========================================

window.logout = async function () {

    if (!confirm("Logout from Viewora?"))
        return;

    try {

        if (auth.currentUser) {

            await db.ref(
                "status/" + auth.currentUser.uid
            ).set({

                online: false,
                lastSeen: Date.now()

            });

        }

        await auth.signOut();

        location.href = "login.html";

    }

    catch (error) {

        alert(error.message);

    }

};

// ==========================================

console.log("✅ APP V4 Part 2 Loaded");
// ==========================================
// VIEWORA APP.JS V4.0
// PART 3
// Users + Search + Profile + Chat
// ==========================================

let usersList = [];
let currentUserData = null;

// ==========================================
// Load Current User
// ==========================================

async function loadCurrentUser() {

    if (!auth.currentUser) return;

    const snap = await db
        .ref("users/" + auth.currentUser.uid)
        .once("value");

    currentUserData = snap.val() || {};

}

// ==========================================
// Load Users
// ==========================================

window.loadUsers = async function () {

    const container =
        document.getElementById("usersList");

    if (!container) return;

    await loadCurrentUser();

    db.ref("users")
    .on("value", (snapshot) => {

        usersList = [];

        container.innerHTML = "";

        snapshot.forEach((child) => {

            if (child.key === auth.currentUser.uid)
                return;

            usersList.push({

                uid: child.key,

                ...child.val()

            });

        });

        renderUsers();

    });

};

// ==========================================
// Render Users
// ==========================================

function renderUsers() {

    const container =
        document.getElementById("usersList");

    if (!container) return;

    container.innerHTML = "";

    usersList.forEach((user) => {

        const card =
            document.createElement("div");

        card.className = "user-card";

        card.innerHTML = `

            <img
            src="${user.profilePhoto || "non.jpg"}"
            class="user-photo">

            <div class="user-info">

                <h3>${user.name || "User"}</h3>

                <p>${user.username || ""}</p>

            </div>

        `;

        card.onclick = () => {

            location.href =
                "profile.html?uid=" +
                user.uid;

        };

        container.appendChild(card);

    });

}

// ==========================================
// Search Users
// ==========================================

window.searchUsers = function () {

    const input =
        document.getElementById("searchInput");

    if (!input) return;

    const keyword =
        input.value
        .toLowerCase()
        .trim();

    document
    .querySelectorAll(".user-card")

    .forEach((card) => {

        const name =
            card.innerText
            .toLowerCase();

        card.style.display =
            name.includes(keyword)
            ? "flex"
            : "none";

    });

};

// ==========================================
// Open Profile
// ==========================================

window.openProfile = function (uid) {

    location.href =
        "profile.html?uid=" + uid;

};

// ==========================================
// Open Chat
// ==========================================

window.openChat = function (uid) {

    location.href =
        "chat.html?uid=" + uid;

};

// ==========================================
// Follow User
// ==========================================

window.followUser = async function (uid) {

    if (!auth.currentUser) return;

    await db.ref(
        "following/" +
        auth.currentUser.uid +
        "/" +
        uid
    ).set(true);

    await db.ref(
        "followers/" +
        uid +
        "/" +
        auth.currentUser.uid
    ).set(true);

    alert("Followed");

};

// ==========================================
// Unfollow User
// ==========================================

window.unfollowUser = async function (uid) {

    if (!auth.currentUser) return;

    await db.ref(
        "following/" +
        auth.currentUser.uid +
        "/" +
        uid
    ).remove();

    await db.ref(
        "followers/" +
        uid +
        "/" +
        auth.currentUser.uid
    ).remove();

    alert("Unfollowed");

};

// ==========================================

console.log("✅ APP V4 Part 3 Loaded");
// ==========================================
// VIEWORA APP.JS V4.0
// PART 4
// Presence + Utilities + Auto Init
// ==========================================

// ==========================================
// User Presence
// ==========================================

function initializePresence() {

    if (!auth.currentUser) return;

    const connectedRef =
        firebase.database().ref(".info/connected");

    connectedRef.on("value", (snap) => {

        if (!snap.val()) return;

        const statusRef =
            db.ref("status/" + auth.currentUser.uid);

        statusRef.onDisconnect().set({

            online: false,

            lastSeen: Date.now()

        });

        statusRef.set({

            online: true,

            lastSeen: Date.now()

        });

    });

}

// ==========================================
// Sound Toggle
// ==========================================

window.toggleSound = function () {

    document.querySelectorAll("video").forEach(video => {

        video.muted = !video.muted;

    });

};

// ==========================================
// Shorts Active Effect
// ==========================================

window.setActiveShorts = function () {

    document.querySelectorAll(".short").forEach(short => {

        const rect = short.getBoundingClientRect();

        if (
            rect.top >= 0 &&
            rect.top < window.innerHeight / 2
        ) {

            short.classList.add("active");

        } else {

            short.classList.remove("active");

        }

    });

};

// ==========================================
// Network Status
// ==========================================

window.addEventListener("online", () => {

    console.log("✅ Internet Connected");

});

window.addEventListener("offline", () => {

    alert("No Internet Connection");

});

// ==========================================
// Auto Logout Presence
// ==========================================

window.addEventListener("beforeunload", () => {

    if (!auth.currentUser) return;

    db.ref("status/" + auth.currentUser.uid)

    .update({

        online: false,

        lastSeen: Date.now()

    });

});

// ==========================================
// Auto Initialize
// ==========================================

window.addEventListener("load", () => {

    if (auth.currentUser) {

        initializePresence();

    }

    // Users Page
    if (document.getElementById("usersList")) {

        loadUsers();

    }

    // Search Box
    const search =
        document.getElementById("searchInput");

    if (search) {

        search.addEventListener(
            "input",
            searchUsers
        );

    }

    // Shorts Page
    if (document.querySelector(".short")) {

        window.addEventListener(
            "scroll",
            setActiveShorts
        );

        setActiveShorts();

    }

});

// ==========================================
// Version
// ==========================================

console.log("=================================");
console.log("✅ Viewora APP V4 Loaded");
console.log("Authentication ✔");
console.log("Signup ✔");
console.log("Login ✔");
console.log("Forgot Password ✔");
console.log("Logout ✔");
console.log("Users ✔");
console.log("Search ✔");
console.log("Follow ✔");
console.log("Presence ✔");
console.log("Utilities ✔");
console.log("=================================");