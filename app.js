// ==================== APP.JS - Viewora (Clean Final Version) ====================

// ==================== SOUND TOGGLE ====================
function toggleSound() {
    let videos = document.querySelectorAll("video");
    videos.forEach((video) => {
        video.muted = !video.muted;
    });
}

// ==================== SHORTS ACTIVE EFFECT ====================
function setActiveShorts() {
    let shorts = document.querySelectorAll(".short");
    shorts.forEach((s) => {
        let rect = s.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
            s.classList.add("active");
        } else {
            s.classList.remove("active");
        }
    });
}

// ==================== SIGNUP ====================
function signup() {
    let name = document.getElementById("name").value.trim();
    let email = document.getElementById("email").value.trim();
    let password = document.getElementById("password").value;

    if (!name || !email || !password) {
        alert("Please fill all fields!");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            let user = userCredential.user;

            db.ref("users/" + user.uid).set({
                name: name,
                username: "@" + name.toLowerCase().replace(/\s/g, ""),
                email: email,
                bio: "Welcome to Viewora 🚀",
                profilePhoto: "non.jpg",
                joinedAt: Date.now()
            });

            alert("Signup successful! Please login.");
            window.location.href = "login.html";
        })
        .catch((error) => {
            alert(error.message);
        });
}

// ==================== LOGIN ====================
function login() {
    let email = document.getElementById("email").value.trim();
    let password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Please enter email and password!");
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            window.location.href = "splash.html";
        })
        .catch((error) => {
            alert(error.message);
        });
}

// ==================== LOAD USERS LIST (Old - Ab users.js use ho raha hai) ====================
function loadUsers() {
    const usersList = document.getElementById("usersList");
    if (!usersList) return;

    db.ref("users").on("value", (snapshot) => {
        usersList.innerHTML = "";

        snapshot.forEach((child) => {
            const user = child.val();
            const uid = child.key;

            usersList.innerHTML += `
                <div class="user-card">
                    <h3>${user.name}</h3>
                    <p>${user.username}</p>
                    <button onclick="viewProfile('${uid}')">View Profile</button>
                </div>
            `;
        });
    });
}

// ==================== VIEW PROFILE ====================
function viewProfile(uid) {
    localStorage.setItem("profileUid", uid);
    window.location.href = "profile.html";
}

// ==================== INIT ====================
window.onload = function () {
    if (document.getElementById("usersList")) {
        loadUsers();
    }
};