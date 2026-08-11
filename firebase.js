/*==========================================================
        VIEWORA V12
        firebase.js
        FINAL • PREMIUM AUTH + DATABASE CORE

        Firebase:
        • Authentication
        • Google Login
        • Facebook Login
        • X / Twitter Login
        • Realtime Database
        • Storage
        • Presence
        • Safe Database Helpers
==========================================================*/

"use strict";


/*==========================================================
  1. FIREBASE SDK CHECK
==========================================================*/

if (typeof firebase === "undefined") {

    console.error(
        "❌ Firebase SDK not loaded."
    );

    throw new Error(
        "Firebase SDK not loaded. Check Firebase CDN scripts."
    );

}


/*==========================================================
  2. FIREBASE CONFIG
==========================================================*/

const firebaseConfig = {

    apiKey:
        "AIzaSyByS4lox5JHhG2u4qazZSvwecVjzJRP0mc",

    authDomain:
        "viewora-cc4ac.firebaseapp.com",

    databaseURL:
        "https://viewora-cc4ac-default-rtdb.firebaseio.com",

    projectId:
        "viewora-cc4ac",

    storageBucket:
        "viewora-cc4ac.appspot.com",

    messagingSenderId:
        "988622911735",

    appId:
        "1:988622911735:web:e30c97dd88d5ac87c93bf2"

};


/*==========================================================
  3. FIREBASE INITIALIZATION
==========================================================*/

try {

    if (!firebase.apps.length) {

        firebase.initializeApp(
            firebaseConfig
        );

        console.log(
            "🔥 Firebase App Initialized"
        );

    } else {

        console.log(
            "🔥 Firebase App Already Initialized"
        );

    }

} catch (error) {

    console.error(
        "❌ Firebase Initialization Error:",
        error
    );

    throw error;

}


/*==========================================================
  4. FIREBASE SERVICES
==========================================================*/

let auth = null;
let db = null;
let storage = null;

try {

    auth = firebase.auth();

    db = firebase.database();

    /*
     * Cloudinary is currently used for media upload.
     * Firebase Storage remains optional.
     */

    if (
        typeof firebase.storage === "function"
    ) {

        storage =
            firebase.storage();

    }

} catch (error) {

    console.error(
        "❌ Firebase Services Error:",
        error
    );

    throw error;

}


/*==========================================================
  5. AUTH PROVIDERS
==========================================================*/

/*
 * IMPORTANT:
 *
 * These are declared ONLY HERE.
 *
 * login.js should NOT create these again.
 */

let googleProvider = null;
let facebookProvider = null;
let twitterProvider = null;

try {

    googleProvider =
        new firebase.auth.GoogleAuthProvider();

    googleProvider.setCustomParameters({
        prompt: "select_account"
    });


    facebookProvider =
        new firebase.auth.FacebookAuthProvider();

    facebookProvider.addScope(
        "email"
    );


    /*
     * Firebase uses TwitterAuthProvider
     * for X / Twitter authentication.
     */

    twitterProvider =
        new firebase.auth.TwitterAuthProvider();


} catch (error) {

    console.error(
        "❌ Auth Provider Initialization Error:",
        error
    );

}


/*==========================================================
  6. STANDARD FIELD NAMES
==========================================================*/

const FIELDS = {

    uid: "uid",

    name: "name",

    username: "username",

    email: "email",

    fullName: "fullName",

    profilePhoto: "profilePhoto",

    coverPhoto: "coverPhoto",

    bio: "bio",

    verified: "verified",

    online: "online",

    lastSeen: "lastSeen",

    createdAt: "createdAt",

    lastLogin: "lastLogin",

    followers: "followers",

    following: "following",

    posts: "posts",

    videos: "videos",

    shorts: "shorts"

};


/*==========================================================
  7. DATABASE REFERENCES
==========================================================*/

const usersRef = () =>
    db.ref("users");


const userRef = (uid) =>
    db.ref("users/" + uid);


const postsRef = () =>
    db.ref("posts");


const postRef = (postId) =>
    db.ref("posts/" + postId);


const shortsRef = () =>
    db.ref("shorts");


const shortRef = (shortId) =>
    db.ref("shorts/" + shortId);


const storiesRef = () =>
    db.ref("stories");


const storyRef = (storyId) =>
    db.ref("stories/" + storyId);


const commentsRef = (postId) =>
    db.ref("comments/" + postId);


const likesRef = (postId) =>
    db.ref("likes/" + postId);


const savedPostsRef = (uid) =>
    db.ref("savedPosts/" + uid);


const notificationsRef = (uid) =>
    db.ref("notifications/" + uid);


const chatsRef = () =>
    db.ref("chats");


const chatRef = (chatId) =>
    db.ref("chats/" + chatId);


const userChatsRef = (uid) =>
    db.ref("userChats/" + uid);


const callsRef = () =>
    db.ref("calls");


const callRef = (callId) =>
    db.ref("calls/" + callId);


const followersRef = (uid) =>
    db.ref("followers/" + uid);


const followingRef = (uid) =>
    db.ref("following/" + uid);


const blockedRef = (uid) =>
    db.ref("blockedUsers/" + uid);


const usernamesRef = (username) =>
    db.ref(
        "usernames/" +
        username.toLowerCase()
    );


const presenceRef = (uid) =>
    db.ref("status/" + uid);


const feedsRef = (feed) =>
    db.ref("feeds/" + feed);


/*==========================================================
  8. SERVER TIMESTAMP
==========================================================*/

const SERVER_TIME =
    firebase.database.ServerValue.TIMESTAMP;


/*==========================================================
  9. SAFE DATABASE HELPERS
==========================================================*/

async function safeRead(path) {

    try {

        const snapshot =
            await db
                .ref(path)
                .once("value");

        return snapshot.exists()
            ? snapshot.val()
            : null;

    } catch (error) {

        console.error(
            "❌ safeRead:",
            path,
            error
        );

        return null;

    }

}


async function safeWrite(
    path,
    data
) {

    try {

        await db
            .ref(path)
            .set(data);

        return true;

    } catch (error) {

        console.error(
            "❌ safeWrite:",
            path,
            error
        );

        return false;

    }

}


async function safeUpdate(
    path,
    data
) {

    try {

        await db
            .ref(path)
            .update(data);

        return true;

    } catch (error) {

        console.error(
            "❌ safeUpdate:",
            path,
            error
        );

        return false;

    }

}


async function safeRemove(path) {

    try {

        await db
            .ref(path)
            .remove();

        return true;

    } catch (error) {

        console.error(
            "❌ safeRemove:",
            path,
            error
        );

        return false;

    }

}


/*==========================================================
  10. PRESENCE SYSTEM
==========================================================*/

function setupPresence(uid) {

    if (!uid) {
        return;
    }

    const connectedRef =
        db.ref(".info/connected");

    const statusRef =
        presenceRef(uid);


    connectedRef.on(
        "value",
        snapshot => {

            if (
                snapshot.val() !== true
            ) {

                return;

            }


            statusRef
                .onDisconnect()
                .set({

                    online: false,

                    lastSeen:
                        SERVER_TIME

                });


            statusRef.set({

                online: true,

                lastSeen:
                    SERVER_TIME

            });

        }
    );

}


/*==========================================================
  11. USER ONLINE SYSTEM
==========================================================*/

function setupUserOnline(uid) {

    if (!uid) {
        return;
    }


    const onlineRef =
        userRef(uid)
            .child("online");


    const lastSeenRef =
        userRef(uid)
            .child("lastSeen");


    const connectedRef =
        db.ref(".info/connected");


    connectedRef.on(
        "value",
        snapshot => {

            if (
                snapshot.val() !== true
            ) {

                return;

            }


            onlineRef
                .onDisconnect()
                .set(false);


            lastSeenRef
                .onDisconnect()
                .set(
                    SERVER_TIME
                );


            onlineRef.set(true);


            lastSeenRef.set(
                SERVER_TIME
            );

        }
    );

}


/*==========================================================
  12. AUTH HELPERS
==========================================================*/

function requireAuth() {

    return new Promise(
        (resolve, reject) => {

            let finished = false;


            const unsubscribe =
                auth.onAuthStateChanged(
                    user => {

                        if (finished) {
                            return;
                        }

                        finished = true;

                        unsubscribe();


                        if (user) {

                            resolve(user);

                        } else {

                            reject(
                                new Error(
                                    "User not logged in"
                                )
                            );


                            location.replace(
                                "login.html"
                            );

                        }

                    }
                );

        }
    );

}


function getCurrentUser() {

    return auth.currentUser;

}


function getUID() {

    return auth.currentUser
        ? auth.currentUser.uid
        : null;

}


/*==========================================================
  13. DEFAULT USER OBJECT
==========================================================*/

function createDefaultUser(
    uid,
    data = {}
) {

    return {

        uid: uid,

        name:
            data.name ||
            data.fullName ||
            "Viewora User",

        username:
            data.username ||
            "user",

        email:
            data.email ||
            "",

        fullName:
            data.fullName ||
            data.name ||
            "Viewora User",

        profilePhoto:
            data.profilePhoto ||
            data.photoURL ||
            "assets/default-avatar.png",

        coverPhoto:
            data.coverPhoto ||
            "assets/default-banner.jpg",

        bio:
            data.bio ||
            "Welcome to Viewora 🚀",

        verified:
            data.verified === true,

        online: true,

        followers:
            Number(data.followers || 0),

        following:
            Number(data.following || 0),

        posts:
            Number(data.posts || 0),

        videos:
            Number(data.videos || 0),

        shorts:
            Number(data.shorts || 0),

        createdAt:
            data.createdAt ||
            SERVER_TIME,

        lastSeen:
            SERVER_TIME,

        lastLogin:
            SERVER_TIME

    };

}


/*==========================================================
  14. GLOBAL EXPORTS
==========================================================*/

window.firebaseConfig =
    firebaseConfig;


window.auth =
    auth;


window.db =
    db;


window.storage =
    storage;


window.googleProvider =
    googleProvider;


window.facebookProvider =
    facebookProvider;


window.twitterProvider =
    twitterProvider;


/*
 * Alias for X login.
 * login.js can use either name.
 */

window.xProvider =
    twitterProvider;


window.SERVER_TIME =
    SERVER_TIME;


window.FIELDS =
    FIELDS;


/*==========================================================
  15. DATABASE REFERENCE EXPORTS
==========================================================*/

window.usersRef =
    usersRef;

window.userRef =
    userRef;

window.postsRef =
    postsRef;

window.postRef =
    postRef;

window.shortsRef =
    shortsRef;

window.shortRef =
    shortRef;

window.storiesRef =
    storiesRef;

window.storyRef =
    storyRef;

window.commentsRef =
    commentsRef;

window.likesRef =
    likesRef;

window.savedPostsRef =
    savedPostsRef;

window.notificationsRef =
    notificationsRef;

window.chatsRef =
    chatsRef;

window.chatRef =
    chatRef;

window.userChatsRef =
    userChatsRef;

window.callsRef =
    callsRef;

window.callRef =
    callRef;

window.followersRef =
    followersRef;

window.followingRef =
    followingRef;

window.blockedRef =
    blockedRef;

window.usernamesRef =
    usernamesRef;

window.presenceRef =
    presenceRef;

window.feedsRef =
    feedsRef;


/*==========================================================
  16. HELPER EXPORTS
==========================================================*/

window.safeRead =
    safeRead;

window.safeWrite =
    safeWrite;

window.safeUpdate =
    safeUpdate;

window.safeRemove =
    safeRemove;

window.setupPresence =
    setupPresence;

window.setupUserOnline =
    setupUserOnline;

window.requireAuth =
    requireAuth;

window.getCurrentUser =
    getCurrentUser;

window.getUID =
    getUID;

window.createDefaultUser =
    createDefaultUser;


/*==========================================================
  17. AUTH STATE
==========================================================*/

auth.onAuthStateChanged(
    user => {

        if (user) {

            console.log(
                "✅ Viewora User Authenticated:",
                user.uid
            );


            setupPresence(
                user.uid
            );


            setupUserOnline(
                user.uid
            );

        } else {

            console.log(
                "👤 No authenticated user"
            );

        }

    }
);


/*==========================================================
  18. DATABASE CONNECTION MONITOR
==========================================================*/

const firebaseConnection =
    db.ref(".info/connected");


firebaseConnection.on(
    "value",
    snapshot => {

        if (
            snapshot.val() === true
        ) {

            console.log(
                "🟢 Firebase Realtime Database Connected"
            );

        } else {

            console.log(
                "🔴 Firebase Realtime Database Disconnected"
            );

        }

    }
);


/*==========================================================
  19. FINAL STARTUP
==========================================================*/

console.log(
    "=========================================="
);

console.log(
    "🚀 VIEWORA FIREBASE V12 READY"
);

console.log(
    "✅ Firebase Initialized"
);

console.log(
    "✅ Authentication Ready"
);

console.log(
    "✅ Google Provider Ready"
);

console.log(
    "✅ Facebook Provider Ready"
);

console.log(
    "✅ X / Twitter Provider Ready"
);

console.log(
    "✅ Realtime Database Ready"
);

console.log(
    "✅ Storage Available"
);

console.log(
    "✅ Presence Ready"
);

console.log(
    "✅ Database Helpers Ready"
);

console.log(
    "=========================================="
);