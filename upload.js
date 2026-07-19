/*=========================================
        VIEWORA STUDIO V2.0
            upload.js
              PART 1
=========================================*/


// ======================================
// Current User
// ======================================

let currentUser = null;
let selectedFile = null;
let uploadType = "video";

// ======================================
// DOM
// ======================================

const uploadBox = document.getElementById("uploadBox");
const filePicker = document.getElementById("filePicker");
const browseBtn = document.getElementById("browseBtn");

const imagePreview =
document.getElementById("imagePreview");

const videoPreview =
document.getElementById("videoPreview");

const previewBox =
document.querySelector(".previewBox");

const progressCard =
document.querySelector(".progressCard");

// ======================================
// Auth Check
// ======================================

auth.onAuthStateChanged(user => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;

    console.log("User Logged In:", user.uid);

});

// ======================================
// Open Picker
// ======================================

browseBtn.onclick=()=>{

filePicker.click();

};

// ======================================
// Card Buttons
// ======================================

document.getElementById("videoCard").onclick=()=>{

uploadType="video";

filePicker.accept="video/*";

uploadBox.classList.remove("hidden");

};

document.getElementById("shortCard").onclick=()=>{

uploadType="short";

filePicker.accept="video/*";

uploadBox.classList.remove("hidden");

};

document.getElementById("storyCard").onclick=()=>{

uploadType="story";

filePicker.accept="image/*,video/*";

uploadBox.classList.remove("hidden");

};

document.getElementById("postCard").onclick=()=>{

uploadType="post";

filePicker.accept="image/*";

uploadBox.classList.remove("hidden");

};

// ======================================
// File Selected
// ======================================

filePicker.addEventListener(

"change",

e=>{

const file=e.target.files[0];

if(!file) return;

handleFile(file);

}

);

// ======================================
// Validation
// ======================================

function handleFile(file){

selectedFile=file;

const maxVideo=2*1024*1024*1024; //2GB

const maxImage=20*1024*1024; //20MB

if(file.type.startsWith("video")){

if(file.size>maxVideo){

alert("Video size too large.");

return;

}

showVideo(file);

}else{

if(file.size>maxImage){

alert("Image size too large.");

return;

}

showImage(file);

}

}

// ======================================
// Image Preview
// ======================================

function showImage(file){

previewBox.classList.remove("hidden");

imagePreview.hidden=false;

videoPreview.hidden=true;

imagePreview.src=

URL.createObjectURL(file);

}

// ======================================
// Video Preview
// ======================================

function showVideo(file){

previewBox.classList.remove("hidden");

videoPreview.hidden=false;

imagePreview.hidden=true;

videoPreview.src=

URL.createObjectURL(file);

}

// ======================================
// Drag & Drop
// ======================================

const dropZone=

document.querySelector(".dropZone");

["dragenter","dragover"]

.forEach(event=>{

dropZone.addEventListener(

event,

e=>{

e.preventDefault();

dropZone.classList.add("dragging");

}

);

});

["dragleave","drop"]

.forEach(event=>{

dropZone.addEventListener(

event,

e=>{

e.preventDefault();

dropZone.classList.remove("dragging");

}

);

});

dropZone.addEventListener(

"drop",

e=>{

const file=

e.dataTransfer.files[0];

if(file)

handleFile(file);

});

// ======================================
// File Size
// ======================================

function formatSize(bytes){

const units=[

"B","KB","MB","GB"

];

let i=0;

while(bytes>=1024&&i<3){

bytes/=1024;

i++;

}

return bytes.toFixed(1)+" "+units[i];

}

console.log("✅ Upload Part 1 Ready");
/*=========================================
        VIEWORA STUDIO V2.0
            upload.js
              PART 2
 Firebase Storage Upload
=========================================*/

// ======================================
// Upload Variables
// ======================================

let uploadTask = null;
let uploadPaused = false;

// ======================================
// Progress Elements
// ======================================

const progressFill =
document.getElementById("progressFill");

const progressPercent =
document.getElementById("progressPercent");

// ======================================
// Start Upload
// ======================================

async function startUpload(){

    if(!selectedFile){

        showToast("Please select a file first.");

        return;

    }

    progressCard.classList.remove("hidden");

    const extension =
    selectedFile.name.split(".").pop();

    const fileName =
    Date.now()+"."+extension;

    const folder = {

        video:"videos",

        short:"shorts",

        story:"stories",

        post:"posts"

    };

    const storageRef = storage
        .ref(folder[uploadType]+"/"+fileName);

    uploadTask =
    storageRef.put(selectedFile);

    uploadTask.on(

        "state_changed",

        snapshot=>{

            const percent = Math.floor(

                snapshot.bytesTransferred /

                snapshot.totalBytes *100

            );

            progressFill.style.width=
            percent+"%";

            progressPercent.textContent=
            percent+"%";

        },

        error=>{

            console.error(error);

            showToast("Upload Failed");

        },

        async()=>{

            const url =
            await uploadTask.snapshot.ref
            .getDownloadURL();

            uploadFinished(url);

        }

    );

}

// ======================================
// Pause Upload
// ======================================

function pauseUpload(){

    if(uploadTask){

        uploadTask.pause();

        uploadPaused=true;

        showToast("Upload Paused");

    }

}

// ======================================
// Resume Upload
// ======================================

function resumeUpload(){

    if(uploadTask && uploadPaused){

        uploadTask.resume();

        uploadPaused=false;

        showToast("Upload Resumed");

    }

}

// ======================================
// Cancel Upload
// ======================================

function cancelUpload(){

    if(uploadTask){

        uploadTask.cancel();

        progressFill.style.width="0%";

        progressPercent.textContent="0%";

        progressCard.classList.add("hidden");

        showToast("Upload Cancelled");

    }

}

// ======================================
// Save Metadata
// ======================================


    await db
        .ref(uploadType+"/"+id)
        .set(data);

    showToast("Upload Successful 🎉");

    progressFill.style.width="100%";

    progressPercent.textContent="100%";

}

// ======================================
// Helper Toast
// ======================================

function showToast(message){

    console.log(message);

    // Replace with your premium toast UI

}

console.log("✅ Upload Part 2 Ready");
/*=========================================
        VIEWORA STUDIO V2.0
            upload.js
              PART 3
 Publish Content
=========================================*/

// ======================================
// Publish Button
// ======================================

async function publishContent(){

    if(!selectedFile){

        showToast("Select a file first");

        return;

    }

    await startUpload();

}

// ======================================
// Save Upload Data
// ======================================

async function saveUpload(fileURL){

    const id = db.ref().push().key;

    const data = {

        id:id,

        uid:currentUser.uid,

        type:uploadType,

        fileURL:fileURL,

        title:getTitle(),

        description:getDescription(),

        tags:getTags(),

        visibility:"public",

        likes:0,

        comments:0,

        shares:0,

        views:0,

        createdAt:Date.now()

    };

    await db
    .ref(uploadType+"s/"+id)
    .set(data);

    updateAnalytics();

    showToast("Published Successfully 🎉");

}

// ======================================
// Title
// ======================================

function getTitle(){

    const input =
    document.getElementById("title");

    return input ? input.value.trim() : "";

}

// ======================================
// Description
// ======================================

function getDescription(){

    const input =
    document.getElementById("description");

    return input ? input.value.trim() : "";

}

// ======================================
// Tags
// ======================================

function getTags(){

    const input =
    document.getElementById("tags");

    if(!input) return [];

    return input.value
    .split(",")
    .map(t=>t.trim())
    .filter(Boolean);

}

// ======================================
// Analytics
// ======================================

async function updateAnalytics(){

    const ref = db.ref(
        "creatorAnalytics/"+currentUser.uid
    );

    const snap =
    await ref.once("value");

    let total = 0;

    if(snap.exists()){

        total =
        snap.val().uploads || 0;

    }

    await ref.update({

        uploads:total+1,

        lastUpload:Date.now()

    });

}

// ======================================
// Notify Followers
// ======================================

async function notifyFollowers(){

    const snap =
    await db.ref(
        "followers/"+currentUser.uid
    ).once("value");

    snap.forEach(f=>{

        db.ref(
            "notifications/"
            +f.key
        ).push({

            title:"New Upload",

            body:"A creator uploaded new content.",

            time:Date.now()

        });

    });

}

// ======================================
// Finish Upload
// ======================================

async function uploadFinished(url){

    await saveUpload(url);

    await notifyFollowers();

    progressFill.style.width="100%";

    progressPercent.textContent="100%";

    selectedFile = null;

}

// ======================================
// Button Event
// ======================================

const publishBtn =
document.getElementById("publishBtn");

if(publishBtn){

    publishBtn.onclick =
    publishContent;

}

console.log("✅ Upload Part 3 Ready");
/*=========================================
        VIEWORA STUDIO V2.0
            upload.js
              PART 4
 Draft • Retry • Validation • Offline
=========================================*/

// ======================================
// Save Draft
// ======================================

function saveDraft(){

    const draft={

        type:uploadType,

        title:getTitle(),

        description:getDescription(),

        tags:getTags(),

        time:Date.now()

    };

    localStorage.setItem(

        "vieworaDraft",

        JSON.stringify(draft)

    );

    showToast("Draft Saved 💾");

}

// ======================================
// Load Draft
// ======================================

function loadDraft(){

    const draft=

    JSON.parse(

    localStorage.getItem("vieworaDraft")

    );

    if(!draft) return;

    const title=document.getElementById("title");

    const desc=document.getElementById("description");

    const tags=document.getElementById("tags");

    if(title) title.value=draft.title;

    if(desc) desc.value=draft.description;

    if(tags) tags.value=draft.tags.join(",");

}

// ======================================
// Retry Upload
// ======================================

function retryUpload(){

    if(selectedFile){

        startUpload();

    }

}

// ======================================
// Internet Status
// ======================================

window.addEventListener("offline",()=>{

    showToast("No Internet 📡");

});

window.addEventListener("online",()=>{

    showToast("Connected 🌐");

});

// ======================================
// Shorts Validation
// ======================================

function validateShort(video){

    return new Promise(resolve=>{

        const media=document.createElement("video");

        media.preload="metadata";

        media.onloadedmetadata=()=>{

            resolve(media.duration<=60);

        };

        media.src=URL.createObjectURL(video);

    });

}

// ======================================
// Video Validation
// ======================================

async function validateUpload(){

    if(uploadType==="short"){

        const ok=

        await validateShort(selectedFile);

        if(!ok){

            showToast(

            "Short must be under 60 seconds"

            );

            return false;

        }

    }

    return true;

}

// ======================================
// Publish Wrapper
// ======================================

async function publish(){

    if(!selectedFile){

        showToast("Select File");

        return;

    }

    const valid=

    await validateUpload();

    if(!valid) return;

    startUpload();

}

// ======================================
// Upload Statistics
// ======================================

async function updateStatistics(){

    const ref=

    db.ref("stats");

    const snap=

    await ref.once("value");

    const total=

    snap.exists()

    ?snap.val().uploads||0

    :0;

    await ref.update({

        uploads:total+1

    });

}

// ======================================
// Upload Success
// ======================================

async function uploadSuccess(url){

    await saveUpload(url);

    await updateStatistics();

    showToast("Upload Completed 🎉");

    localStorage.removeItem("vieworaDraft");

}

// ======================================
// Auto Draft
// ======================================

setInterval(()=>{

    saveDraft();

},30000);

// ======================================
// Restore Draft
// ======================================

window.addEventListener(

"load",

loadDraft

);

// ======================================
// Before Exit
// ======================================

window.addEventListener(

"beforeunload",

()=>{

saveDraft();

});

console.log("✅ Upload Part 4 Ready");
firebase.auth().onAuthStateChanged(user => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    currentUser = user;

    loadChat();

});
async function publishContent(){

    try{

        await startUpload();

    }catch(e){

        console.error(e);

    }

}