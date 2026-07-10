// =======================================
// Viewora Upload System - PART 1
// =======================================

let currentUser = null;
let selectedFile = null;
let selectedType = null; // 'video' or 'short'

// Auth
auth.onAuthStateChanged(user => {
    if (!user) {
        location.href = "login.html";
        return;
    }
    currentUser = user;
});

// File Picker
const picker = document.getElementById("videoPicker");

function selectVideoFile(type) {
    selectedType = type;
    picker.click();
}

picker.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("video/")) {
        alert("Video file select karo");
        return;
    }
    selectedFile = file;
    checkVideoDuration(file);
});

function checkVideoDuration(file) {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
        const duration = video.duration;

        if (selectedType === "short" && duration > 60) {
            alert("Shorts 60 seconds se kam hone chahiye");
            return;
        }
        if (selectedType === "video" && duration > 43200) {
            alert("Video 12 hours se zyada nahi ho sakta");
            return;
        }

        selectedType === "short" ? showShortSection() : showVideoSection();
    };
    video.src = URL.createObjectURL(file);
}

// Show Sections
function showVideoSection() {
    hideAll();
    document.getElementById("videoSection").style.display = "block";
    document.getElementById("videoPreview").src = URL.createObjectURL(selectedFile);
}

function showShortSection() {
    hideAll();
    document.getElementById("shortSection").style.display = "block";
    document.getElementById("shortPreview").src = URL.createObjectURL(selectedFile);
}

function openLiveSection() {
    hideAll();
    document.getElementById("liveSection").style.display = "block";
}

function openPostSection() {
    hideAll();
    document.getElementById("postSection").style.display = "block";
}

function hideAll() {
    document.querySelectorAll(".upload-section").forEach(s => s.style.display = "none");
}

console.log("✅ Upload Part 1 Loaded");
// =======================================
// Viewora Upload System - PART 2
// =======================================

// Upload Helper
async function uploadFile(file, progressBarId, progressTextId) {
    const fileName = Date.now() + "_" + file.name;
    const uploadTask = storage.ref(`uploads/\( {currentUser.uid}/ \){fileName}`).put(file);

    return new Promise((resolve, reject) => {
        uploadTask.on("state_changed",
            snap => {
                const progress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                document.getElementById(progressBarId).style.width = progress + "%";
                document.getElementById(progressTextId).textContent = progress + "%";
            },
            reject,
            async () => resolve(await uploadTask.snapshot.ref.getDownloadURL())
        );
    });
}

// Publish Video
async function publishVideo() {
    if (!selectedFile) return alert("Select a video");
    const title = document.getElementById("videoTitle").value.trim();
    if (!title) return alert("Title daalo");

    const url = await uploadFile(selectedFile, "videoProgressBar", "videoProgressText");

    const id = db.ref("videos").push().key;
    await db.ref("videos/" + id).set({
        id, owner: currentUser.uid, title,
        description: document.getElementById("videoDescription").value,
        videoURL: url,
        createdAt: Date.now()
    });

    alert("✅ Video Published!");
    resetAll();
}

// Publish Short
async function publishShort() {
    if (!selectedFile) return alert("Select a short");

    const url = await uploadFile(selectedFile, "shortProgressBar", "shortProgressText");

    const id = db.ref("shorts").push().key;
    await db.ref("shorts/" + id).set({
        id, owner: currentUser.uid,
        caption: document.getElementById("shortCaption").value,
        videoURL: url,
        createdAt: Date.now()
    });

    alert("🎬 Short Published!");
    resetAll();
}

// Publish Live
async function startLive() {
    const id = db.ref("liveStreams").push().key;
    await db.ref("liveStreams/" + id).set({
        id,
        owner: currentUser.uid,
        title: document.getElementById("liveTitle").value,
        description: document.getElementById("liveDescription").value,
        createdAt: Date.now()
    });
    alert("🔴 Live Created!");
    resetAll();
}

// Publish Post
async function publishPost() {
    const text = document.getElementById("postContent").value.trim();
    if (!text) return alert("Kuch likho");

    const id = db.ref("posts").push().key;
    await db.ref("posts/" + id).set({
        id,
        owner: currentUser.uid,
        content: text,
        createdAt: Date.now()
    });

    alert("📝 Post Published!");
    resetAll();
}

function resetAll() {
    selectedFile = null;
    document.querySelectorAll("input, textarea").forEach(el => el.value = "");
    document.querySelectorAll(".progressFill").forEach(bar => bar.style.width = "0%");
}

// Init
window.addEventListener("load", () => {
    console.log("🚀 Upload System Ready");
});