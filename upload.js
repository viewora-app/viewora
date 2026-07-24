/*=========================================
        VIEWORA V10 PREMIUM
            upload.js
            PART 1
Firebase • Auth • DOM • Startup
=========================================*/

"use strict";

/*=========================================
Firebase Check
=========================================*/

if(typeof firebase==="undefined"){
    throw new Error("Firebase SDK Missing");
}

if(typeof auth==="undefined"){
    throw new Error("Firebase Auth Missing");
}

if(typeof db==="undefined"){
    throw new Error("Realtime Database Missing");
}

if(typeof storage==="undefined"){
    throw new Error("Firebase Storage Missing");
}

/*=========================================
DOM Elements
=========================================*/

const uploadForm =
document.getElementById("uploadForm");

const mediaInput =
document.getElementById("mediaInput");

const thumbnailInput =
document.getElementById("thumbnailInput");

const dropZone =
document.getElementById("dropZone");

const previewVideo =
document.getElementById("previewVideo");

const previewImage =
document.getElementById("previewImage");

const titleInput =
document.getElementById("title");

const captionInput =
document.getElementById("caption");

const hashtagsInput =
document.getElementById("hashtags");

const mentionsInput =
document.getElementById("mentions");

const categorySelect =
document.getElementById("category");

const visibilitySelect =
document.getElementById("visibility");

const uploadBtn =
document.getElementById("uploadPostBtn");

const saveDraftBtn =
document.getElementById("saveDraftBtn");

const cancelBtn =
document.getElementById("cancelUploadBtn");

const loadingOverlay =
document.getElementById("loadingOverlay");

const toast =
document.getElementById("toast");

const toastText =
document.getElementById("toastText");

const toastIcon =
document.getElementById("toastIcon");

/*=========================================
Variables
=========================================*/

let currentUser = null;

let selectedFile = null;

let selectedThumbnail = null;

let uploadTask = null;

let uploading = false;

let draftKey = "viewora_upload_draft";

/*=========================================
Loading
=========================================*/

function showLoading(){

    if(!loadingOverlay) return;

    loadingOverlay.classList.remove("hidden");

}

function hideLoading(){

    if(!loadingOverlay) return;

    loadingOverlay.classList.add("hidden");

}

/*=========================================
Toast
=========================================*/

let toastTimer = null;

function showToast(message,type="success"){

    if(!toast) return;

    toastText.textContent = message;

    if(type==="success"){

        toastIcon.className =
        "fa-solid fa-circle-check";

        toastIcon.style.color =
        "#00d26a";

    }else{

        toastIcon.className =
        "fa-solid fa-circle-xmark";

        toastIcon.style.color =
        "#ff4d67";

    }

    toast.classList.remove("hidden");

    requestAnimationFrame(()=>{

        toast.classList.add("show");

    });

    clearTimeout(toastTimer);

    toastTimer = setTimeout(()=>{

        toast.classList.remove("show");

        setTimeout(()=>{

            toast.classList.add("hidden");

        },300);

    },3000);

}

/*=========================================
Authentication
=========================================*/

auth.onAuthStateChanged(async(user)=>{

    if(!user){

        location.replace("login.html");

        return;

    }

    await user.reload();

    currentUser = user;

    console.log("Logged In :",user.uid);

    loadUserProfile();

});

/*=========================================
Load User Profile
=========================================*/

async function loadUserProfile(){

    try{

        const snap = await db
        .ref("users/"+currentUser.uid)
        .once("value");

        if(!snap.exists()){

            showToast(
            "User profile not found",
            "error"
            );

            return;

        }

        console.log(
        "Profile Loaded",
        snap.val()
        );

    }

    catch(error){

        console.error(error);

        showToast(
        "Failed to load profile",
        "error"
        );

    }

}

/*=========================================
Startup
=========================================*/

window.addEventListener("load",()=>{

    hideLoading();

    console.log("================================");
    console.log("🚀 VIEWORA UPLOAD V10");
    console.log("✅ Firebase Ready");
    console.log("✅ Authentication Ready");
    console.log("✅ Storage Ready");
    console.log("✅ Database Ready");
    console.log("================================");

});
/*=========================================
        VIEWORA V10 PREMIUM
            upload.js
            PART 2
Drag & Drop • File Picker
Preview • Validation
=========================================*/

/*=========================================
Supported Files
=========================================*/

const IMAGE_TYPES=[
"image/jpeg",
"image/jpg",
"image/png",
"image/webp"
];

const VIDEO_TYPES=[
"video/mp4",
"video/webm",
"video/quicktime",
"video/x-matroska"
];

const MAX_IMAGE_SIZE=10*1024*1024;
const MAX_VIDEO_SIZE=500*1024*1024;

/*=========================================
Choose File
=========================================*/

if(dropZone){

dropZone.addEventListener("click",()=>{

mediaInput.click();

});

}

if(mediaInput){

mediaInput.addEventListener(

"change",

e=>{

if(e.target.files.length){

handleSelectedFile(

e.target.files[0]

);

}

});

}

/*=========================================
Drag Events
=========================================*/

["dragenter","dragover"].forEach(event=>{

dropZone.addEventListener(event,e=>{

e.preventDefault();

dropZone.classList.add("dragover");

});

});

["dragleave","dragend"].forEach(event=>{

dropZone.addEventListener(event,e=>{

e.preventDefault();

dropZone.classList.remove("dragover");

});

});

dropZone.addEventListener("drop",e=>{

e.preventDefault();

dropZone.classList.remove("dragover");

if(e.dataTransfer.files.length){

handleSelectedFile(

e.dataTransfer.files[0]

);

}

});

/*=========================================
Handle Selected File
=========================================*/

function handleSelectedFile(file){

if(!file) return;

const isImage=

IMAGE_TYPES.includes(file.type);

const isVideo=

VIDEO_TYPES.includes(file.type);

if(!isImage && !isVideo){

showToast(

"Unsupported file type",

"error"

);

return;

}

if(

isImage &&

file.size>MAX_IMAGE_SIZE

){

showToast(

"Image must be under 10 MB",

"error"

);

return;

}

if(

isVideo &&

file.size>MAX_VIDEO_SIZE

){

showToast(

"Video must be under 500 MB",

"error"

);

return;

}

selectedFile=file;

showPreview(file);

updateFileInfo(file);

}

/*=========================================
Preview
=========================================*/

function showPreview(file){

const url=

URL.createObjectURL(file);

previewImage.classList.add("hidden");

previewVideo.classList.add("hidden");

if(file.type.startsWith("image")){

previewImage.src=url;

previewImage.classList.remove("hidden");

}

if(file.type.startsWith("video")){

previewVideo.src=url;

previewVideo.load();

previewVideo.classList.remove("hidden");

}

}

/*=========================================
File Information
=========================================*/

function updateFileInfo(file){

const fileName=

document.getElementById("fileName");

const fileSize=

document.getElementById("videoSize");

const badge=

document.getElementById("fileTypeBadge");

if(fileName){

fileName.textContent=file.name;

}

if(fileSize){

fileSize.textContent=

formatBytes(file.size);

}

if(badge){

badge.textContent=

file.type.startsWith("video")

?"VIDEO"

:"IMAGE";

}

}

/*=========================================
Format Bytes
=========================================*/

function formatBytes(bytes){

if(bytes===0) return "0 Bytes";

const k=1024;

const sizes=[

"Bytes",

"KB",

"MB",

"GB"

];

const i=Math.floor(

Math.log(bytes)/

Math.log(k)

);

return(

bytes/

Math.pow(k,i)

).toFixed(2)

+" "+sizes[i];

}

/*=========================================
Reset Preview
=========================================*/

function resetPreview(){

selectedFile=null;

mediaInput.value="";

previewImage.src="";

previewVideo.src="";

previewImage.classList.add("hidden");

previewVideo.classList.add("hidden");

}

/*=========================================
Cancel Upload
=========================================*/

if(cancelBtn){

cancelBtn.addEventListener(

"click",

()=>{

resetPreview();

showToast(

"Selection cleared"

);

});

}

console.log("✅ Upload Part 2 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            upload.js
            PART 3
Thumbnail • Video Metadata
Hashtags • Mentions • Counters
=========================================*/

"use strict";

/*=========================================
DOM Elements
=========================================*/

const thumbnailPreview =
document.getElementById("thumbnailPreview");

const titleCounter =
document.getElementById("titleCounter");

const captionCounter =
document.getElementById("captionCounter");

const durationText =
document.getElementById("videoDuration");

const resolutionText =
document.getElementById("videoResolution");

const hashtagPreview =
document.getElementById("hashtagPreview");

const mentionPreview =
document.getElementById("mentionPreview");

/*=========================================
Thumbnail Upload
=========================================*/

if(thumbnailInput){

thumbnailInput.addEventListener(
"change",
handleThumbnail
);

}

function handleThumbnail(e){

const file=e.target.files[0];

if(!file) return;

if(!file.type.startsWith("image")){

showToast(
"Thumbnail must be an image",
"error"
);

return;

}

selectedThumbnail=file;

const url=
URL.createObjectURL(file);

thumbnailPreview.innerHTML=
`<img src="${url}" alt="Thumbnail">`;

}

/*=========================================
Video Metadata
=========================================*/

if(previewVideo){

previewVideo.addEventListener(

"loadedmetadata",

()=>{

const width=
previewVideo.videoWidth;

const height=
previewVideo.videoHeight;

const duration=
previewVideo.duration;

if(durationText){

durationText.textContent=

formatDuration(duration);

}

if(resolutionText){

resolutionText.textContent=

width+" × "+height;

}

}

);

}

/*=========================================
Duration Format
=========================================*/

function formatDuration(seconds){

seconds=Math.floor(seconds);

const min=
Math.floor(seconds/60);

const sec=
seconds%60;

return String(min).padStart(2,"0")

+":"

+String(sec).padStart(2,"0");

}

/*=========================================
Auto Thumbnail
=========================================*/

function generateVideoThumbnail(){

if(!selectedFile) return;

if(!selectedFile.type.startsWith("video"))

return;

const canvas=
document.createElement("canvas");

const ctx=
canvas.getContext("2d");

previewVideo.currentTime=1;

previewVideo.onseeked=()=>{

canvas.width=
previewVideo.videoWidth;

canvas.height=
previewVideo.videoHeight;

ctx.drawImage(

previewVideo,

0,

0,

canvas.width,

canvas.height

);

thumbnailPreview.innerHTML="";

thumbnailPreview.appendChild(canvas);

};

}

/*=========================================
Character Counter
=========================================*/

if(titleInput){

titleInput.addEventListener(

"input",

()=>{

if(titleCounter){

titleCounter.textContent=

titleInput.value.length

+"/100";

}

}

);

}

if(captionInput){

captionInput.addEventListener(

"input",

()=>{

if(captionCounter){

captionCounter.textContent=

captionInput.value.length

+"/5000";

}

extractHashtags();

extractMentions();

}

);

}

/*=========================================
Hashtags
=========================================*/

function extractHashtags(){

const tags=

captionInput.value.match(

/#[a-zA-Z0-9_]+/g

)||[];

if(hashtagPreview){

hashtagPreview.innerHTML=

tags.map(tag=>

`<span>${tag}</span>`

).join("");

}

return tags;

}

/*=========================================
Mentions
=========================================*/

function extractMentions(){

const mentions=

captionInput.value.match(

/@[a-zA-Z0-9_]+/g

)||[];

if(mentionPreview){

mentionPreview.innerHTML=

mentions.map(user=>

`<span>${user}</span>`

).join("");

}

return mentions;

}

/*=========================================
Auto Generate Thumbnail
=========================================*/

if(previewVideo){

previewVideo.addEventListener(

"canplay",

generateVideoThumbnail

);

}

console.log(
"✅ Upload Part 3 Loaded"
);
/*=========================================
        VIEWORA V10 PREMIUM
            upload.js
            PART 4
Firebase Storage Upload
Progress • Speed • ETA • Cancel
=========================================*/

"use strict";

/*=========================================
Progress Elements
=========================================*/

const progressSection =
document.getElementById("progressSection");

const progressFill =
document.getElementById("progressFill");

const progressPercent =
document.getElementById("progressPercent");

const uploadSpeed =
document.getElementById("uploadSpeed");

const remainingTime =
document.getElementById("remainingTime");

/*=========================================
Upload Variables
=========================================*/

let uploadTask = null;
let uploadStartTime = 0;

/*=========================================
Upload File
=========================================*/

async function uploadMediaFile(){

    if(!selectedFile){

        showToast(
        "Please select a file",
        "error"
        );

        return null;

    }

    if(!currentUser){

        showToast(
        "Login required",
        "error"
        );

        return null;

    }

    uploading = true;

    showLoading();

    progressSection?.classList.remove("hidden");

    uploadStartTime = Date.now();

    const extension =
    selectedFile.name.split(".").pop();

    const fileName =
    Date.now()+"."+extension;

    const folder =
    selectedFile.type.startsWith("video")
    ? "videos"
    : "images";

    const storageRef =
    storage.ref(
    folder+"/"+
    currentUser.uid+"/"+
    fileName
    );

    uploadTask =
    storageRef.put(selectedFile);

    return new Promise((resolve,reject)=>{

        uploadTask.on(

        "state_changed",

        snapshot=>{

            const percent =
            Math.floor(

            (snapshot.bytesTransferred/

            snapshot.totalBytes)

            *100

            );

            if(progressFill){

                progressFill.style.width =
                percent+"%";

            }

            if(progressPercent){

                progressPercent.textContent =
                percent+"%";

            }

            updateUploadStats(snapshot);

        },

        error=>{

            hideLoading();

            uploading = false;

            console.error(error);

            showToast(

            error.message,

            "error"

            );

            reject(error);

        },

        async()=>{

            const downloadURL =

            await uploadTask.snapshot.ref

            .getDownloadURL();

            hideLoading();

            uploading = false;

            showToast(

            "Media uploaded"

            );

            resolve(downloadURL);

        });

    });

}

/*=========================================
Upload Statistics
=========================================*/

function updateUploadStats(snapshot){

    const elapsed =

    (Date.now()-uploadStartTime)

    /1000;

    if(elapsed<=0) return;

    const speed =

    snapshot.bytesTransferred

    /elapsed;

    const remaining =

    snapshot.totalBytes-

    snapshot.bytesTransferred;

    const eta =

    remaining/

    speed;

    if(uploadSpeed){

        uploadSpeed.textContent =

        formatSpeed(speed);

    }

    if(remainingTime){

        remainingTime.textContent =

        formatETA(eta);

    }

}

/*=========================================
Speed Formatter
=========================================*/

function formatSpeed(bytes){

    if(bytes<1024)

    return bytes.toFixed(0)

    +" B/s";

    if(bytes<1024*1024)

    return(

    bytes/1024

    ).toFixed(1)

    +" KB/s";

    return(

    bytes/

    (1024*1024)

    ).toFixed(2)

    +" MB/s";

}

/*=========================================
ETA Formatter
=========================================*/

function formatETA(sec){

    sec=Math.max(0,Math.floor(sec));

    const m=Math.floor(sec/60);

    const s=sec%60;

    return

    String(m).padStart(2,"0")

    +":"

    +String(s).padStart(2,"0");

}

/*=========================================
Cancel Upload
=========================================*/

function cancelUpload(){

    if(uploadTask){

        uploadTask.cancel();

        uploading=false;

        hideLoading();

        showToast(

        "Upload cancelled",

        "error"

        );

    }

}

if(cancelBtn){

cancelBtn.addEventListener(

"click",

()=>{

if(uploading){

cancelUpload();

}else{

resetPreview();

}

});

}

/*=========================================
Retry Upload
=========================================*/

async function retryUpload(){

    if(!selectedFile){

        showToast(

        "No file selected",

        "error"

        );

        return;

    }

    try{

        await uploadMediaFile();

    }

    catch(error){

        console.error(error);

    }

}

console.log("✅ Upload Part 4 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            upload.js
            PART 5
Realtime Database Save
=========================================*/

"use strict";

/*=========================================
Save Post
=========================================*/

async function publishPost(mediaURL, thumbnailURL = "") {

    try {

        const user = auth.currentUser;

        if (!user) {
            throw new Error("User not logged in");
        }

        const postRef = db.ref("posts").push();
        const postId = postRef.key;

        const title = titleInput.value.trim();
        const caption = captionInput.value.trim();

        const hashtags =
            caption.match(/#[a-zA-Z0-9_]+/g) || [];

        const mentions =
            caption.match(/@[a-zA-Z0-9_]+/g) || [];

        const mediaType =
            selectedFile.type.startsWith("video")
            ? "video"
            : "image";

        const postData = {

            postId,

            uid: user.uid,

            username: currentUserData.username,

            fullName: currentUserData.fullName,

            profilePhoto: currentUserData.profilePhoto,

            title,

            caption,

            hashtags,

            mentions,

            mediaType,

            mediaURL,

            thumbnailURL,

            duration: previewVideo?.duration || 0,

            visibility: "public",

            commentsEnabled: true,

            downloadAllowed: false,

            views: 0,

            likes: 0,

            comments: 0,

            shares: 0,

            createdAt:
            firebase.database.ServerValue.TIMESTAMP

        };

        await postRef.set(postData);

        /*=========================
        User Posts
        =========================*/

        await db.ref(
        "userPosts/" +
        user.uid + "/" +
        postId
        ).set(true);

        /*=========================
        Home Feed
        =========================*/

        await db.ref(
        "feeds/home/" +
        postId
        ).set(true);

        /*=========================
        Shorts Feed
        =========================*/

        if (mediaType === "video") {

            await db.ref(
            "feeds/shorts/" +
            postId
            ).set(true);

        }

        /*=========================
        Update User Stats
        =========================*/

        await db.ref(
        "users/" + user.uid + "/posts"
        ).transaction(value => {

            return (value || 0) + 1;

        });

        showToast(
        "Post Published Successfully"
        );

        resetUploadForm();

    }

    catch(error){

        console.error(error);

        showToast(
        error.message,
        "error"
        );

    }

}

/*=========================================
Upload + Publish
=========================================*/

async function startUpload(){

    try{

        const mediaURL =
        await uploadMediaFile();

        let thumbnailURL = "";

        if(selectedThumbnail){

            const thumbRef =

            storage.ref(

            "thumbnails/" +

            auth.currentUser.uid +

            "/" +

            Date.now()+".jpg"

            );

            await thumbRef.put(selectedThumbnail);

            thumbnailURL =

            await thumbRef.getDownloadURL();

        }

        await publishPost(

            mediaURL,

            thumbnailURL

        );

    }

    catch(error){

        console.error(error);

        showToast(

        "Upload failed",

        "error"

        );

    }

}

uploadBtn.addEventListener(
"click",
startUpload
);

console.log("✅ Upload Part 5 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            upload.js
            PART 6
Draft • Auto Save • Schedule
=========================================*/

"use strict";

/*=========================================
Draft Storage Key
=========================================*/

const DRAFT_KEY = "viewora_upload_draft";

/*=========================================
Save Draft
=========================================*/

function saveDraft(){

    const draft={

        title:titleInput.value.trim(),

        caption:captionInput.value.trim(),

        hashtags:hashtagsInput
        ?hashtagsInput.value.trim()
        :"",

        mentions:mentionsInput
        ?mentionsInput.value.trim()
        :"",

        category:categorySelect.value,

        visibility:visibilitySelect.value,

        savedAt:Date.now()

    };

    localStorage.setItem(

        DRAFT_KEY,

        JSON.stringify(draft)

    );

    showToast("Draft Saved");

}

/*=========================================
Restore Draft
=========================================*/

function restoreDraft(){

    const data=

    localStorage.getItem(DRAFT_KEY);

    if(!data) return;

    try{

        const draft=

        JSON.parse(data);

        titleInput.value=
        draft.title||"";

        captionInput.value=
        draft.caption||"";

        if(hashtagsInput){

            hashtagsInput.value=
            draft.hashtags||"";

        }

        if(mentionsInput){

            mentionsInput.value=
            draft.mentions||"";

        }

        categorySelect.value=
        draft.category||"general";

        visibilitySelect.value=
        draft.visibility||"public";

        extractHashtags();

        extractMentions();

        showToast(
        "Draft Restored"
        );

    }

    catch(error){

        console.error(error);

    }

}

/*=========================================
Clear Draft
=========================================*/

function clearDraft(){

    localStorage.removeItem(
    DRAFT_KEY
    );

}

/*=========================================
Auto Save
=========================================*/

let autoDraftTimer=null;

function startAutoSave(){

    clearInterval(autoDraftTimer);

    autoDraftTimer=setInterval(()=>{

        saveDraft();

    },30000);

}

[
titleInput,
captionInput,
categorySelect,
visibilitySelect

].forEach(element=>{

if(element){

element.addEventListener(

"input",

startAutoSave

);

}

});

/*=========================================
Manual Draft Button
=========================================*/

if(saveDraftBtn){

saveDraftBtn.addEventListener(

"click",

saveDraft

);

}

/*=========================================
Schedule Upload
=========================================*/

async function scheduleUpload(uploadTime){

    const now=Date.now();

    const delay=

    uploadTime-now;

    if(delay<=0){

        showToast(

        "Invalid schedule time",

        "error"

        );

        return;

    }

    showToast(

    "Upload Scheduled"

    );

    setTimeout(async()=>{

        await startUpload();

    },delay);

}

/*=========================================
Notifications
=========================================*/

function uploadNotification(title,body){

    if(

    !"Notification"

    in window

    ) return;

    if(

    Notification.permission

    ==="granted"

    ){

        new Notification(

        title,

        {

            body:body,

            icon:"assets/logo.png"

        }

        );

    }

}

if(

"Notification"

in window

){

Notification.requestPermission();

}

/*=========================================
After Successful Upload
=========================================*/

function uploadCompleted(){

    clearDraft();

    uploadNotification(

    "Viewora",

    "Your upload completed successfully."

    );

}

/*=========================================
Startup
=========================================*/

window.addEventListener(

"load",

()=>{

restoreDraft();

startAutoSave();

});

console.log("✅ Upload Part 6 Loaded");
/*=========================================
        VIEWORA V10 PREMIUM
            upload.js
            PART 7
Production Security • Network
Toast • Success Modal
Error Handling • Cleanup
=========================================*/

"use strict";

/*=========================================
DOM Elements
=========================================*/

const successModal =
document.getElementById("successModal");

const uploadFailedModal =
document.getElementById("uploadFailedModal");

const networkBanner =
document.getElementById("networkBanner");

const retryUploadBtn =
document.getElementById("retryUploadBtn");

const successOkBtn =
document.getElementById("successOkBtn");

/*=========================================
Network Status
=========================================*/

function updateNetworkStatus(){

    if(!networkBanner) return;

    if(navigator.onLine){

        networkBanner.classList.add("hidden");

        showToast(
            "Internet Connected"
        );

    }else{

        networkBanner.classList.remove("hidden");

        showToast(
            "No Internet Connection",
            "error"
        );

    }

}

window.addEventListener(
"online",
updateNetworkStatus
);

window.addEventListener(
"offline",
updateNetworkStatus
);

/*=========================================
Security Validation
=========================================*/

function validateUpload(){

    if(!auth.currentUser){

        showToast(
        "Please login first",
        "error"
        );

        return false;

    }

    if(!selectedFile){

        showToast(
        "Select a file",
        "error"
        );

        return false;

    }

    if(titleInput.value.trim().length<3){

        showToast(
        "Enter title",
        "error"
        );

        return false;

    }

    if(titleInput.value.length>100){

        showToast(
        "Title too long",
        "error"
        );

        return false;

    }

    if(captionInput.value.length>5000){

        showToast(
        "Caption limit exceeded",
        "error"
        );

        return false;

    }

    return true;

}

/*=========================================
Success Modal
=========================================*/

function showSuccessModal(){

    if(successModal){

        successModal.classList.remove(
        "hidden"
        );

    }

}

if(successOkBtn){

successOkBtn.onclick=()=>{

successModal.classList.add(
"hidden"
);

location.href="profile.html";

};

}

/*=========================================
Upload Failed Modal
=========================================*/

function showUploadFailed(){

    if(uploadFailedModal){

        uploadFailedModal.classList.remove(
        "hidden"
        );

    }

}

if(retryUploadBtn){

retryUploadBtn.onclick=()=>{

uploadFailedModal.classList.add(
"hidden"
);

startUpload();

};

}

/*=========================================
Safe Upload
=========================================*/

async function safeUpload(){

    if(!validateUpload()) return;

    try{

        await startUpload();

        uploadCompleted();

        showSuccessModal();

    }

    catch(error){

        console.error(error);

        showUploadFailed();

    }

}

/*=========================================
Button
=========================================*/

if(uploadBtn){

uploadBtn.onclick=(e)=>{

e.preventDefault();

safeUpload();

};

}

/*=========================================
Global Error Handler
=========================================*/

window.addEventListener(

"error",

event=>{

console.error(event.error);

showToast(

"Unexpected Error",

"error"

);

}

);

window.addEventListener(

"unhandledrejection",

event=>{

console.error(event.reason);

showToast(

"Promise Failed",

"error"

);

}

);

/*=========================================
Cleanup
=========================================*/

window.addEventListener(

"beforeunload",

()=>{

if(uploadTask){

try{

uploadTask.cancel();

}catch(e){}

}

});

/*=========================================
Startup
=========================================*/

window.addEventListener(

"load",

()=>{

updateNetworkStatus();

console.log("================================");
console.log("🚀 VIEWORA V10 UPLOAD");
console.log("✅ Firebase Connected");
console.log("✅ Storage Ready");
console.log("✅ Database Ready");
console.log("✅ Upload Ready");
console.log("✅ Production Mode");
console.log("================================");

});

console.log("✅ Upload Part 7 Loaded");
