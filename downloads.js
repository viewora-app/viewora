// =======================================
// Viewora Downloads
// Part 1
// =======================================

// Current User
let currentUser = null;

// Firebase Reference
let downloadsRef = null;

// =======================================
// Authentication
// =======================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    currentUser = user;

    downloadsRef = db.ref("downloads/" + currentUser.uid);

    loadDownloads();

});

// =======================================
// Load Downloads
// =======================================

function loadDownloads() {

    if (!currentUser) return;

    downloadsRef.once("value")

    .then((snapshot) => {

        const list =
        document.getElementById("downloadsList");

        const empty =
        document.getElementById("emptyDownloads");

        list.innerHTML = "";

        if (!snapshot.exists()) {

            empty.style.display = "block";

            updateStorage(0);

            return;

        }

        empty.style.display = "none";

        let totalSize = 0;

        snapshot.forEach((child) => {

            const file = child.val();

            totalSize += Number(file.size || 0);

            list.appendChild(

                createDownloadCard(

                    child.key,

                    file

                )

            );

        });

        updateStorage(totalSize);

        showToast("📥 Downloads Loaded");

    })

    .catch((error) => {

        console.error(error);

        showToast("❌ Failed to load downloads");

    });

}

// =======================================
// Create Download Card
// =======================================

function createDownloadCard(id, file) {

    const card = document.createElement("div");

    card.className = "download-card";

    card.dataset.name =
        (file.name || "").toLowerCase();

    card.innerHTML = `

        <img
        class="thumb"
        src="${file.thumbnail || 'default-thumb.png'}">

        <div class="download-info">

            <h3>${file.name || "Unknown File"}</h3>

            <p>${file.type || "File"} • ${file.sizeText || "0 MB"}</p>

            <small>

                ${file.date || "Recently Downloaded"}

            </small>

        </div>

        <div class="download-actions">

            <button
            class="open-btn"
            onclick="openFile('${id}')">

            ▶

            </button>

            <button
            class="delete-btn"
            onclick="deleteDownload('${id}')">

            🗑

            </button>

        </div>

    `;

    return card;

}

// =======================================
// Storage Usage
// =======================================

function updateStorage(totalMB){

    const limit = 5120; // 5 GB

    const percent =
        Math.min((totalMB / limit) * 100,100);

    const used =
        document.getElementById("storageUsed");

    const bar =
        document.querySelector(".progress-bar");

    if(used){

        used.textContent =
        `${(totalMB/1024).toFixed(2)} GB / 5 GB`;

    }

    if(bar){

        bar.style.width = percent + "%";

    }

}

console.log("✅ Downloads Part 1 Loaded");
// =======================================
// Viewora Downloads
// Part 2
// Search + Open + Delete + Realtime Sync
// =======================================

// =============================
// Search Downloads
// =============================

const searchInput = document.getElementById("searchDownload");

if (searchInput) {

    searchInput.addEventListener("input", function () {

        const keyword = this.value.toLowerCase().trim();

        const cards = document.querySelectorAll(".download-card");

        let visible = 0;

        cards.forEach(card => {

            const name = card.dataset.name || "";

            if (name.includes(keyword)) {

                card.style.display = "flex";

                visible++;

            } else {

                card.style.display = "none";

            }

        });

        const empty = document.getElementById("emptyDownloads");

        if (cards.length > 0 && visible === 0) {

            empty.style.display = "block";

            empty.querySelector("h2").innerText = "No Results";

            empty.querySelector("p").innerText =
                "No downloaded file matched your search.";

        } else if (cards.length > 0) {

            empty.style.display = "none";

        }

    });

}

// =============================
// Open Download
// =============================

async function openFile(id) {

    try {

        const snapshot = await downloadsRef.child(id).once("value");

        if (!snapshot.exists()) {

            showToast("❌ File Not Found");

            return;

        }

        const file = snapshot.val();

        if (file.url) {

            window.open(file.url, "_blank");

            showToast("📂 Opening File");

        } else {

            showToast("⚠️ File URL Missing");

        }

    }

    catch (error) {

        console.error(error);

        showToast("❌ Unable To Open");

    }

}

// =============================
// Delete Download
// =============================

async function deleteDownload(id) {

    const ok = confirm("Delete this download?");

    if (!ok) return;

    try {

        await downloadsRef.child(id).remove();

        showToast("🗑️ Download Deleted");

        loadDownloads();

    }

    catch (error) {

        console.error(error);

        showToast("❌ Delete Failed");

    }

}

// =============================
// Refresh Downloads
// =============================

function refreshDownloads() {

    loadDownloads();

    showToast("🔄 Downloads Refreshed");

}

// =============================
// Firebase Live Sync
// =============================

function enableDownloadSync() {

    if (!downloadsRef) return;

    downloadsRef.on("value", () => {

        loadDownloads();

    });

}

enableDownloadSync();

// =============================

console.log("✅ Downloads Part 2 Loaded");
// =======================================
// Viewora Downloads
// Part 3
// Clear All + Export + Auto Refresh
// =======================================

// =============================
// Clear All Downloads
// =============================

async function clearAllDownloads() {

    if (!currentUser) return;

    const ok = confirm(
        "Delete ALL downloaded files?"
    );

    if (!ok) return;

    try {

        await downloadsRef.remove();

        loadDownloads();

        showToast("🧹 All Downloads Deleted");

    }

    catch (error) {

        console.error(error);

        showToast("❌ Failed To Delete");

    }

}

// =============================
// Export Downloads List
// =============================

async function exportDownloads() {

    if (!currentUser) return;

    try {

        const snapshot =
        await downloadsRef.once("value");

        const data = snapshot.val() || {};

        const blob = new Blob(

            [JSON.stringify(data, null, 2)],

            { type: "application/json" }

        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        link.download = "viewora-downloads.json";

        link.click();

        URL.revokeObjectURL(url);

        showToast("📥 Downloads Exported");

    }

    catch (error) {

        console.error(error);

        showToast("❌ Export Failed");

    }

}

// =============================
// Auto Refresh
// =============================

let autoRefreshTimer = null;

function startAutoRefresh() {

    stopAutoRefresh();

    autoRefreshTimer = setInterval(() => {

        loadDownloads();

    }, 30000);

}

function stopAutoRefresh() {

    if (autoRefreshTimer) {

        clearInterval(autoRefreshTimer);

        autoRefreshTimer = null;

    }

}

startAutoRefresh();

// =============================
// Refresh Storage
// =============================

function refreshStorageUsage() {

    downloadsRef.once("value")

    .then((snapshot) => {

        let total = 0;

        snapshot.forEach((child) => {

            total += Number(child.val().size || 0);

        });

        updateStorage(total);

    });

}

// =============================
// Internet Status
// =============================

window.addEventListener("online", () => {

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline", () => {

    showToast("📡 No Internet Connection");

});

// =============================
// Pull To Refresh
// =============================

let touchStartY = 0;

window.addEventListener("touchstart", (e) => {

    touchStartY = e.touches[0].clientY;

});

window.addEventListener("touchend", (e) => {

    const touchEndY = e.changedTouches[0].clientY;

    if (touchEndY - touchStartY > 120) {

        loadDownloads();

        refreshStorageUsage();

        showToast("🔄 Refreshing Downloads...");

    }

});

console.log("✅ Downloads Part 3 Loaded");
// =======================================
// Viewora Downloads
// Part 4 (Final)
// =======================================

// =============================
// Premium Toast
// =============================

function showToast(message) {

    let toast = document.getElementById("vieworaToast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "vieworaToast";

        toast.style.cssText = `
            position:fixed;
            left:50%;
            bottom:30px;
            transform:translateX(-50%);
            background:linear-gradient(135deg,#00aaff,#00c853);
            color:#fff;
            padding:14px 24px;
            border-radius:30px;
            font-size:15px;
            font-weight:bold;
            box-shadow:0 12px 30px rgba(0,170,255,.35);
            z-index:99999;
            opacity:0;
            transition:.35s;
        `;

        document.body.appendChild(toast);

    }

    toast.textContent = message;

    toast.style.opacity = "1";

    clearTimeout(toast.hideTimer);

    toast.hideTimer = setTimeout(() => {

        toast.style.opacity = "0";

    }, 2500);

}

// =============================
// Logout
// =============================

async function logout() {

    if (!confirm("Logout from Viewora?")) return;

    try {

        await auth.signOut();

        showToast("👋 Logged Out");

        setTimeout(() => {

            window.location.href = "login.html";

        }, 800);

    }

    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

// =============================
// Page Visibility
// =============================

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {

        stopAutoRefresh();

    } else {

        startAutoRefresh();

        loadDownloads();

        refreshStorageUsage();

    }

});

// =============================
// Cleanup
// =============================

window.addEventListener("beforeunload", () => {

    stopAutoRefresh();

    if (downloadsRef) {

        downloadsRef.off();

    }

});

// =============================
// Startup
// =============================

window.addEventListener("load", () => {

    startAutoRefresh();

    loadDownloads();

    refreshStorageUsage();

    showToast("📥 Downloads Ready");

});

// =============================
// Debug Logs
// =============================

console.log("==================================");
console.log("📥 Viewora Downloads Loaded");
console.log("✅ Firebase Connected");
console.log("✅ Storage Manager Ready");
console.log("✅ Search Enabled");
console.log("✅ Auto Refresh Running");
console.log("==================================");