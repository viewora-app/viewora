// =======================================
// Viewora Creator Upload
// upload.js - Part 1
// =======================================

// Current User
let currentUser = null;

// Selected File
let selectedFile = null;
let selectedType = null; // video | short

// =======================================
// Authentication
// =======================================

auth.onAuthStateChanged(user => {

    if (!user) {

        location.href = "login.html";
        return;

    }

    currentUser = user;

});

// =======================================
// File Picker
// =======================================

const picker = document.getElementById("videoPicker");

function selectVideoFile(type) {

    selectedType = type;

    picker.value = "";

    picker.click();

}

picker.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {

        alert("Please select a video.");

        return;

    }

    selectedFile = file;

    checkVideoDuration(file);

});

// =======================================
// Duration Check
// =======================================

function checkVideoDuration(file) {

    const video = document.createElement("video");

    video.preload = "metadata";

    video.onloadedmetadata = function () {

        URL.revokeObjectURL(video.src);

        const duration = video.duration;

        if (selectedType === "short") {

            if (duration > 60) {

                alert("Shorts must be 60 seconds or less.");

                return;

            }

            showShortSection(file);

        }

        else {

            if (duration > 43200) {

                alert("Videos cannot exceed 12 hours.");

                return;

            }

            showVideoSection(file);

        }

    };

    video.src = URL.createObjectURL(file);

}

// =======================================
// Preview
// =======================================

function showVideoSection(file) {

    hideSections();

    document.getElementById("videoSection").style.display = "block";

    const preview = document.getElementById("videoPreview");

    preview.src = URL.createObjectURL(file);

    preview.load();

}

function showShortSection(file) {

    hideSections();

    document.getElementById("shortSection").style.display = "block";

    const preview = document.getElementById("shortPreview");

    preview.src = URL.createObjectURL(file);

    preview.load();

}

// =======================================
// Hide Sections
// =======================================

function hideSections() {

    document.getElementById("videoSection").style.display = "none";

    document.getElementById("shortSection").style.display = "none";

    document.getElementById("liveSection").style.display = "none";

    document.getElementById("postSection").style.display = "none";

}

// =======================================
// Live & Post
// =======================================

function openLiveSection() {

    hideSections();

    document.getElementById("liveSection").style.display = "block";

}

function openPostSection() {

    hideSections();

    document.getElementById("postSection").style.display = "block";

}

console.log("✅ upload.js Part 1 Loaded");
// =======================================
// Viewora Creator Upload
// upload.js - Part 2
// Firebase Storage Upload
// =======================================

// Upload URLs
let uploadedVideoURL = "";
let uploadedThumbnailURL = "";

// =======================================
// Upload Video File
// =======================================

async function uploadVideoToStorage(file, progressBarId, progressTextId) {

    if (!currentUser || !file) {
        throw new Error("No user or file selected.");
    }

    const fileName =
        Date.now() + "_" + file.name.replace(/\s+/g, "_");

    const path =
        `uploads/${currentUser.uid}/${fileName}`;

    const uploadTask =
        storage.ref(path).put(file);

    return new Promise((resolve, reject) => {

        uploadTask.on(

            "state_changed",

            (snapshot) => {

                const progress = Math.round(
                    (snapshot.bytesTransferred /
                        snapshot.totalBytes) * 100
                );

                updateProgress(
                    progressBarId,
                    progressTextId,
                    progress
                );

            },

            (error) => {

                console.error(error);

                alert("Upload failed.");

                reject(error);

            },

            async () => {

                const url =
                    await uploadTask.snapshot.ref.getDownloadURL();

                uploadedVideoURL = url;

                resolve(url);

            }

        );

    });

}

// =======================================
// Upload Thumbnail
// =======================================

async function uploadThumbnail() {

    const input =
        document.getElementById("thumbnailPicker");

    if (!input || !input.files.length)
        return "";

    const file = input.files[0];

    const fileName =
        Date.now() + "_" + file.name.replace(/\s+/g, "_");

    const path =
        `thumbnails/${currentUser.uid}/${fileName}`;

    const uploadTask =
        storage.ref(path).put(file);

    return new Promise((resolve, reject) => {

        uploadTask.on(

            "state_changed",

            null,

            reject,

            async () => {

                const url =
                    await uploadTask.snapshot.ref.getDownloadURL();

                uploadedThumbnailURL = url;

                resolve(url);

            }

        );

    });

}

// =======================================
// Progress
// =======================================

function updateProgress(barId, textId, percent) {

    const bar =
        document.getElementById(barId);

    const text =
        document.getElementById(textId);

    if (bar)
        bar.style.width = percent + "%";

    if (text)
        text.textContent =
            percent + "% Uploaded";

}

function resetProgress() {

    updateProgress(
        "videoProgressBar",
        "videoProgressText",
        0
    );

    updateProgress(
        "shortProgressBar",
        "shortProgressText",
        0
    );

}

console.log("✅ upload.js Part 2 Loaded");
// =======================================
// Viewora Creator Upload
// upload.js - Part 3
// Publish Content
// =======================================

// =======================================
// Publish Video
// =======================================

async function publishVideo() {

    if (!selectedFile) {
        alert("Please select a video.");
        return;
    }

    const title =
        document.getElementById("videoTitle").value.trim();

    if (!title) {
        alert("Enter video title.");
        return;
    }

    try {

        const videoURL =
            await uploadVideoToStorage(
                selectedFile,
                "videoProgressBar",
                "videoProgressText"
            );

        const thumbnailURL =
            await uploadThumbnail();

        const videoId =
            db.ref("videos").push().key;

        await db.ref("videos/" + videoId).set({

            id: videoId,

            owner: currentUser.uid,

            title,

            description:
                document.getElementById("videoDescription").value,

            tags:
                document.getElementById("videoTags").value,

            category:
                document.getElementById("videoCategory").value,

            visibility:
                document.getElementById("videoVisibility").value,

            audience:
                document.getElementById("videoAudience").value,

            videoURL,

            thumbnailURL,

            duration: 0,

            views: 0,

            likes: 0,

            comments: 0,

            createdAt: Date.now()

        });

        alert("✅ Video Published");

        resetProgress();

    }

    catch (e) {

        console.error(e);

        alert("Publish failed.");

    }

}

// =======================================
// Publish Short
// =======================================

async function publishShort() {

    if (!selectedFile) {

        alert("Select a short.");

        return;

    }

    try {

        const shortURL =
            await uploadVideoToStorage(

                selectedFile,

                "shortProgressBar",

                "shortProgressText"

            );

        const shortId =
            db.ref("shorts").push().key;

        await db.ref("shorts/" + shortId).set({

            id: shortId,

            owner: currentUser.uid,

            caption:
                document.getElementById("shortCaption").value,

            tags:
                document.getElementById("shortTags").value,

            visibility:
                document.getElementById("shortVisibility").value,

            videoURL: shortURL,

            likes: 0,

            comments: 0,

            views: 0,

            createdAt: Date.now()

        });

        alert("🎬 Short Published");

        resetProgress();

    }

    catch (e) {

        console.error(e);

        alert("Upload failed.");

    }

}

// =======================================
// Live
// =======================================

async function startLive() {

    const id =
        db.ref("liveStreams").push().key;

    await db.ref("liveStreams/" + id).set({

        id,

        owner: currentUser.uid,

        title:
            document.getElementById("liveTitle").value,

        description:
            document.getElementById("liveDescription").value,

        visibility:
            document.getElementById("liveVisibility").value,

        schedule:
            document.getElementById("liveSchedule").value,

        status: "scheduled",

        createdAt: Date.now()

    });

    alert("🔴 Live Created");

}

// =======================================
// Community Post
// =======================================

async function publishPost() {

    const text =
        document.getElementById("postContent").value.trim();

    if (!text) {

        alert("Write something.");

        return;

    }

    const id =
        db.ref("posts").push().key;

    await db.ref("posts/" + id).set({

        id,

        owner: currentUser.uid,

        content: text,

        allowComments:
            document.getElementById("allowComments").checked,

        createdAt: Date.now()

    });

    alert("📝 Post Published");

}

console.log("✅ upload.js Part 3 Loaded");
// =======================================
// Viewora Creator Upload
// upload.js - Part 4 (Final)
// =======================================

// Toast
function showToast(message) {

    let toast = document.getElementById("uploadToast");

    if (!toast) {

        toast = document.createElement("div");

        toast.id = "uploadToast";

        toast.style.cssText = `
            position:fixed;
            bottom:25px;
            left:50%;
            transform:translateX(-50%);
            background:#202020;
            color:#fff;
            padding:14px 24px;
            border-radius:12px;
            box-shadow:0 8px 25px rgba(0,0,0,.3);
            z-index:99999;
            opacity:0;
            transition:.3s;
        `;

        document.body.appendChild(toast);

    }

    toast.textContent = message;
    toast.style.opacity = "1";

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {

        toast.style.opacity = "0";

    }, 2500);

}

// =======================================
// Reset Forms
// =======================================

function resetForms() {

    selectedFile = null;

    if (picker)
        picker.value = "";

    const ids = [

        "videoTitle",
        "videoDescription",
        "videoTags",
        "shortCaption",
        "shortTags",
        "liveTitle",
        "liveDescription",
        "postContent"

    ];

    ids.forEach(id => {

        const el = document.getElementById(id);

        if (el)
            el.value = "";

    });

    resetProgress();

}

// =======================================
// Draft
// =======================================

function saveDraft() {

    localStorage.setItem("viewora_upload_draft", JSON.stringify({

        videoTitle:
            document.getElementById("videoTitle")?.value || "",

        videoDescription:
            document.getElementById("videoDescription")?.value || "",

        shortCaption:
            document.getElementById("shortCaption")?.value || ""

    }));

}

function restoreDraft() {

    const draft =
        JSON.parse(localStorage.getItem("viewora_upload_draft"));

    if (!draft)
        return;

    if (document.getElementById("videoTitle"))
        document.getElementById("videoTitle").value =
            draft.videoTitle || "";

    if (document.getElementById("videoDescription"))
        document.getElementById("videoDescription").value =
            draft.videoDescription || "";

    if (document.getElementById("shortCaption"))
        document.getElementById("shortCaption").value =
            draft.shortCaption || "";

}

setInterval(saveDraft, 10000);

// =======================================
// Internet
// =======================================

window.addEventListener("online", () => {

    showToast("🌐 Internet Connected");

});

window.addEventListener("offline", () => {

    showToast("📡 Internet Disconnected");

});

// =======================================
// Startup
// =======================================

window.addEventListener("load", () => {

    restoreDraft();

    resetProgress();

    console.log("🚀 Viewora Upload Ready");

});

// =======================================
// Cleanup
// =======================================

window.addEventListener("beforeunload", () => {

    saveDraft();

});

console.log("✅ upload.js Fully Loaded");