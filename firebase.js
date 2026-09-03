/*==========================================================
        VIEWORA V12
        firebase.js
        FINAL • PREMIUM AUTH + DATABASE + NOTIFICATION CORE

        Firebase:
        • Authentication
        • Google Login
        • Facebook Login
        • X / Twitter Login
        • Realtime Database
        • Storage
        • Presence
        • Safe Database Helpers
        • Like Notifications
        • Comment Notifications
        • Follow Notifications
        • Story Mention Notifications
        • Story Reaction Notifications
        • Story Reply Notifications
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

    auth =
        firebase.auth();

    db =
        firebase.database();

    /*
     * Cloudinary can be used for media uploads.
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


const notificationRef = (
    uid,
    notificationId
) =>
    db.ref(
        "notifications/" +
        uid +
        "/" +
        notificationId
    );


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
        String(username || "").toLowerCase()
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
  9. SAFE NUMBER HELPER
==========================================================*/

/*
 * Prevents Firebase errors such as:
 *
 * values argument contains NaN
 *
 * This is especially important for:
 * followers
 * following
 * likes
 * comments
 * views
 */

function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}


/*==========================================================
  10. SAFE DATABASE HELPERS
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
  11. PRESENCE SYSTEM
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
  12. USER ONLINE SYSTEM
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
  13. AUTH HELPERS
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
  14. DEFAULT USER OBJECT
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
            safeNumber(
                data.followers
            ),

        following:
            safeNumber(
                data.following
            ),

        posts:
            safeNumber(
                data.posts
            ),

        videos:
            safeNumber(
                data.videos
            ),

        shorts:
            safeNumber(
                data.shorts
            ),

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
  15. USER PROFILE SNAPSHOT
==========================================================*/

/*
 * Gets the latest sender/user information.
 *
 * Notification will still work if some profile fields
 * are missing.
 */

async function getNotificationUser(
    uid
) {

    if (!uid) {

        return {

            uid: "",

            name: "Viewora User",

            username: "",

            profilePhoto:
                "assets/default-avatar.png"

        };

    }


    try {

        const snapshot =
            await userRef(uid)
                .once("value");


        const user =
            snapshot.exists()
                ? snapshot.val()
                : {};


        return {

            uid: uid,

            name:
                user.name ||
                user.fullName ||
                "Viewora User",

            username:
                user.username ||
                "",

            profilePhoto:
                user.profilePhoto ||
                user.photoURL ||
                "assets/default-avatar.png"

        };

    } catch (error) {

        console.error(
            "❌ getNotificationUser:",
            error
        );


        return {

            uid: uid,

            name: "Viewora User",

            username: "",

            profilePhoto:
                "assets/default-avatar.png"

        };

    }

}


/*==========================================================
  16. NOTIFICATION MESSAGE BUILDER
==========================================================*/

function getNotificationMessage(
    type,
    data = {},
    fromName = "Someone"
) {

    switch (type) {

        case "like":

            return (
                fromName +
                " liked your post"
            );


        case "comment":

            return (
                fromName +
                " commented on your post"
            );


        case "follow":

            return (
                fromName +
                " started following you"
            );


        case "story_mention":

            return (
                fromName +
                " mentioned you in their story"
            );


        case "story_reaction":

            return (
                fromName +
                " reacted to your story" +
                (
                    data.reaction
                        ? " " + data.reaction
                        : ""
                )
            );


        case "story_reply":

            return (
                fromName +
                " replied to your story"
            );


        default:

            return (
                data.message ||
                (
                    fromName +
                    " interacted with you"
                )
            );

    }

}


/*==========================================================
  17. CREATE NOTIFICATION
==========================================================*/

/*
 * MAIN NOTIFICATION FUNCTION
 *
 * Usage:
 *
 * createNotification({
 *     toUid: authorUid,
 *     fromUid: currentUid,
 *     type: "like",
 *     postId: postId
 * });
 *
 * Self notification is automatically blocked.
 */

async function createNotification(
    options = {}
) {

    try {

        const {

            toUid,

            fromUid,

            type = "general",

            postId = null,

            storyId = null,

            commentId = null,

            reaction = null,

            message = "",

            actionUrl = "",

            extra = {}

        } = options;


        /*------------------------------------------
          REQUIRED USER CHECK
        ------------------------------------------*/

        if (!toUid) {

            console.warn(
                "⚠️ Notification skipped: missing toUid"
            );

            return false;

        }


        if (!fromUid) {

            console.warn(
                "⚠️ Notification skipped: missing fromUid"
            );

            return false;

        }


        /*------------------------------------------
          SELF NOTIFICATION BLOCK
        ------------------------------------------*/

        if (
            String(toUid) ===
            String(fromUid)
        ) {

            console.log(
                "ℹ️ Self notification skipped:",
                type
            );

            return false;

        }


        /*------------------------------------------
          GET SENDER PROFILE
        ------------------------------------------*/

        const sender =
            await getNotificationUser(
                fromUid
            );


        const notificationMessage =
            message ||
            getNotificationMessage(
                type,
                {
                    reaction:
                        reaction
                },
                sender.name
            );


        /*------------------------------------------
          CREATE UNIQUE ID
        ------------------------------------------*/

        const notificationKey =
            notificationsRef(toUid)
                .push()
                .key;


        if (!notificationKey) {

            console.error(
                "❌ Could not create notification key"
            );

            return false;

        }


        /*------------------------------------------
          NOTIFICATION OBJECT
        ------------------------------------------*/

        const notification = {

            id:
                notificationKey,

            type:
                type,

            uid:
                fromUid,

            fromUid:
                fromUid,

            fromName:
                sender.name,

            fromPhoto:
                sender.profilePhoto,

            fromAvatar:
                sender.profilePhoto,

            fromUsername:
                sender.username || "",

            message:
                notificationMessage,

            postId:
                postId || null,

            storyId:
                storyId || null,

            commentId:
                commentId || null,

            reaction:
                reaction || null,

            actionUrl:
                actionUrl ||
                (
                    postId
                        ? "post.html?id=" +
                          encodeURIComponent(postId)

                        : storyId
                            ? "stories.html?id=" +
                              encodeURIComponent(storyId)

                            : "profile.html?id=" +
                              encodeURIComponent(fromUid)
                ),

            isRead:
                false,

            createdAt:
                SERVER_TIME

        };


        /*------------------------------------------
          ADD EXTRA FIELDS SAFELY
        ------------------------------------------*/

        Object.keys(extra || {})
            .forEach(key => {

                if (
                    key === "id" ||
                    key === "createdAt" ||
                    key === "isRead"
                ) {

                    return;

                }


                notification[key] =
                    extra[key];

            });


        /*------------------------------------------
          SAVE NOTIFICATION
        ------------------------------------------*/

        await notificationRef(
            toUid,
            notificationKey
        ).set(
            notification
        );


        console.log(
            "🔔 Notification created:",
            type,
            "→",
            toUid
        );


        return true;

    } catch (error) {

        console.error(
            "❌ createNotification Error:",
            error
        );

        return false;

    }

}


/*==========================================================
  18. LIKE NOTIFICATION
==========================================================*/

async function notifyPostLike(
    postId,
    postAuthorUid,
    likerUid
) {

    if (
        !postId ||
        !postAuthorUid ||
        !likerUid
    ) {

        return false;

    }


    return await createNotification({

        toUid:
            postAuthorUid,

        fromUid:
            likerUid,

        type:
            "like",

        postId:
            postId,

        actionUrl:
            "post.html?id=" +
            encodeURIComponent(postId)

    });

}


/*==========================================================
  19. COMMENT NOTIFICATION
==========================================================*/

async function notifyPostComment(
    postId,
    postAuthorUid,
    commenterUid,
    commentId = null
) {

    if (
        !postId ||
        !postAuthorUid ||
        !commenterUid
    ) {

        return false;

    }


    return await createNotification({

        toUid:
            postAuthorUid,

        fromUid:
            commenterUid,

        type:
            "comment",

        postId:
            postId,

        commentId:
            commentId,

        actionUrl:
            "post.html?id=" +
            encodeURIComponent(postId)

    });

}


/*==========================================================
  20. FOLLOW NOTIFICATION
==========================================================*/

async function notifyFollow(
    targetUid,
    followerUid
) {

    if (
        !targetUid ||
        !followerUid
    ) {

        return false;

    }


    return await createNotification({

        toUid:
            targetUid,

        fromUid:
            followerUid,

        type:
            "follow",

        actionUrl:
            "profile.html?id=" +
            encodeURIComponent(followerUid)

    });

}


/*==========================================================
  21. STORY MENTION NOTIFICATION
==========================================================*/

/*
 * Call this when @username is mentioned in a story.
 */

async function notifyStoryMention(
    storyId,
    storyOwnerUid,
    mentionedUid
) {

    if (
        !storyId ||
        !storyOwnerUid ||
        !mentionedUid
    ) {

        return false;

    }


    return await createNotification({

        toUid:
            mentionedUid,

        fromUid:
            storyOwnerUid,

        type:
            "story_mention",

        storyId:
            storyId,

        actionUrl:
            "stories.html?id=" +
            encodeURIComponent(storyId)

    });

}


/*==========================================================
  22. STORY REACTION NOTIFICATION
==========================================================*/

/*
 * reaction example:
 *
 * "❤️"
 * "😍"
 * "😂"
 * "😮"
 * "😢"
 * "🔥"
 */

async function notifyStoryReaction(
    storyId,
    storyOwnerUid,
    reactorUid,
    reaction
) {

    if (
        !storyId ||
        !storyOwnerUid ||
        !reactorUid
    ) {

        return false;

    }


    return await createNotification({

        toUid:
            storyOwnerUid,

        fromUid:
            reactorUid,

        type:
            "story_reaction",

        storyId:
            storyId,

        reaction:
            reaction || "",

        actionUrl:
            "stories.html?id=" +
            encodeURIComponent(storyId)

    });

}


/*==========================================================
  23. STORY REPLY NOTIFICATION
==========================================================*/

async function notifyStoryReply(
    storyId,
    storyOwnerUid,
    replierUid,
    replyId = null
) {

    if (
        !storyId ||
        !storyOwnerUid ||
        !replierUid
    ) {

        return false;

    }


    return await createNotification({

        toUid:
            storyOwnerUid,

        fromUid:
            replierUid,

        type:
            "story_reply",

        storyId:
            storyId,

        commentId:
            replyId,

        actionUrl:
            "stories.html?id=" +
            encodeURIComponent(storyId)

    });

}


/*==========================================================
  24. MARK NOTIFICATION AS READ
==========================================================*/

async function markNotificationRead(
    uid,
    notificationId
) {

    if (
        !uid ||
        !notificationId
    ) {

        return false;

    }


    return await safeUpdate(
        "notifications/" +
        uid +
        "/" +
        notificationId,
        {

            isRead:
                true,

            readAt:
                SERVER_TIME

        }
    );

}


/*==========================================================
  25. MARK ALL NOTIFICATIONS AS READ
==========================================================*/

async function markAllNotificationsRead(
    uid
) {

    if (!uid) {

        return false;

    }


    try {

        const snapshot =
            await notificationsRef(uid)
                .once("value");


        if (
            !snapshot.exists()
        ) {

            return true;

        }


        const updates = {};


        snapshot.forEach(
            child => {

                const notification =
                    child.val();


                if (
                    notification &&
                    notification.isRead !== true
                ) {

                    updates[
                        child.key +
                        "/isRead"
                    ] = true;

                    updates[
                        child.key +
                        "/readAt"
                    ] = SERVER_TIME;

                }

            }
        );


        if (
            Object.keys(updates).length
        ) {

            await notificationsRef(uid)
                .update(updates);

        }


        return true;

    } catch (error) {

        console.error(
            "❌ markAllNotificationsRead:",
            error
        );

        return false;

    }

}


/*==========================================================
  26. GET UNREAD NOTIFICATION COUNT
==========================================================*/

async function getUnreadNotificationCount(
    uid
) {

    if (!uid) {

        return 0;

    }


    try {

        const snapshot =
            await notificationsRef(uid)
                .once("value");


        let count = 0;


        if (
            snapshot.exists()
        ) {

            snapshot.forEach(
                child => {

                    const item =
                        child.val();


                    if (
                        item &&
                        item.isRead !== true
                    ) {

                        count++;

                    }

                }
            );

        }


        return count;

    } catch (error) {

        console.error(
            "❌ getUnreadNotificationCount:",
            error
        );

        return 0;

    }

}


/*==========================================================
  27. REALTIME UNREAD NOTIFICATION LISTENER
==========================================================*/

/*
 * callback(count)
 *
 * Example:
 *
 * listenUnreadNotifications(uid, count => {
 *     badge.textContent = count;
 * });
 */

function listenUnreadNotifications(
    uid,
    callback
) {

    if (
        !uid ||
        typeof callback !== "function"
    ) {

        return null;

    }


    const ref =
        notificationsRef(uid);


    const listener =
        ref.on(
            "value",
            snapshot => {

                let count = 0;


                if (
                    snapshot.exists()
                ) {

                    snapshot.forEach(
                        child => {

                            const item =
                                child.val();


                            if (
                                item &&
                                item.isRead !== true
                            ) {

                                count++;

                            }

                        }
                    );

                }


                callback(
                    count
                );

            },
            error => {

                console.error(
                    "❌ Notification listener:",
                    error
                );

                callback(
                    0
                );

            }
        );


    return {

        ref:
            ref,

        event:
            "value",

        callback:
            listener

    };

}


/*==========================================================
  28. DELETE NOTIFICATION
==========================================================*/

async function deleteNotification(
    uid,
    notificationId
) {

    if (
        !uid ||
        !notificationId
    ) {

        return false;

    }


    return await safeRemove(
        "notifications/" +
        uid +
        "/" +
        notificationId
    );

}


/*==========================================================
  29. CLEAR ALL NOTIFICATIONS
==========================================================*/

async function clearAllNotifications(
    uid
) {

    if (!uid) {

        return false;

    }


    return await safeRemove(
        "notifications/" +
        uid
    );

}


/*==========================================================
  30. FOLLOW DATABASE HELPERS
==========================================================*/

/*
 * Safe follow count update.
 *
 * Never allows:
 *
 * NaN
 * negative values
 */

async function updateFollowerCounts(
    followerUid,
    targetUid,
    isFollowing
) {

    if (
        !followerUid ||
        !targetUid ||
        followerUid === targetUid
    ) {

        return false;

    }


    try {

        const followerSnapshot =
            await userRef(followerUid)
                .once("value");


        const targetSnapshot =
            await userRef(targetUid)
                .once("value");


        const follower =
            followerSnapshot.val() || {};


        const target =
            targetSnapshot.val() || {};


        const currentFollowing =
            safeNumber(
                follower.following
            );


        const currentFollowers =
            safeNumber(
                target.followers
            );


        let newFollowing;
        let newFollowers;


        if (isFollowing) {

            newFollowing =
                currentFollowing + 1;

            newFollowers =
                currentFollowers + 1;

        } else {

            newFollowing =
                Math.max(
                    0,
                    currentFollowing - 1
                );

            newFollowers =
                Math.max(
                    0,
                    currentFollowers - 1
                );

        }


        const updates = {};


        updates[
            "users/" +
            followerUid +
            "/following"
        ] =
            newFollowing;


        updates[
            "users/" +
            targetUid +
            "/followers"
        ] =
            newFollowers;


        if (isFollowing) {

            updates[
                "following/" +
                followerUid +
                "/" +
                targetUid
            ] = true;


            updates[
                "followers/" +
                targetUid +
                "/" +
                followerUid
            ] = true;

        } else {

            updates[
                "following/" +
                followerUid +
                "/" +
                targetUid
            ] = null;


            updates[
                "followers/" +
                targetUid +
                "/" +
                followerUid
            ] = null;

        }


        await db.ref()
            .update(updates);


        return true;

    } catch (error) {

        console.error(
            "❌ updateFollowerCounts:",
            error
        );

        return false;

    }

}


/*==========================================================
  31. GLOBAL EXPORTS
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


window.xProvider =
    twitterProvider;


window.SERVER_TIME =
    SERVER_TIME;


window.FIELDS =
    FIELDS;


window.safeNumber =
    safeNumber;


/*==========================================================
  32. DATABASE REFERENCE EXPORTS
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

window.notificationRef =
    notificationRef;

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
  33. HELPER EXPORTS
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
  34. NOTIFICATION EXPORTS
==========================================================*/

window.getNotificationUser =
    getNotificationUser;


window.getNotificationMessage =
    getNotificationMessage;


window.createNotification =
    createNotification;


window.notifyPostLike =
    notifyPostLike;


window.notifyPostComment =
    notifyPostComment;


window.notifyFollow =
    notifyFollow;


window.notifyStoryMention =
    notifyStoryMention;


window.notifyStoryReaction =
    notifyStoryReaction;


window.notifyStoryReply =
    notifyStoryReply;


window.markNotificationRead =
    markNotificationRead;


window.markAllNotificationsRead =
    markAllNotificationsRead;


window.getUnreadNotificationCount =
    getUnreadNotificationCount;


window.listenUnreadNotifications =
    listenUnreadNotifications;


window.deleteNotification =
    deleteNotification;


window.clearAllNotifications =
    clearAllNotifications;


window.updateFollowerCounts =
    updateFollowerCounts;


/*==========================================================
  35. AUTH STATE
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
  36. DATABASE CONNECTION MONITOR
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
  37. FINAL STARTUP
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
    "✅ Safe Database Helpers Ready"
);

console.log(
    "❤️ Like Notification Ready"
);

console.log(
    "💬 Comment Notification Ready"
);

console.log(
    "➕ Follow Notification Ready"
);

console.log(
    "📖 Story Mention Notification Ready"
);

console.log(
    "😍 Story Reaction Notification Ready"
);

console.log(
    "↩️ Story Reply Notification Ready"
);

console.log(
    "🔔 Notification System Ready"
);

console.log(
    "=========================================="
);

/*==========================================================
  CLOUDINARY (Shorts / media upload)
==========================================================*/

window.VIEWORA_CLOUDINARY_CLOUD =
    window.VIEWORA_CLOUDINARY_CLOUD ||
    "z5m6wjdf";

window.VIEWORA_CLOUDINARY_PRESET =
    window.VIEWORA_CLOUDINARY_PRESET ||
    "Viewora-upload";

window.VIEWORA_CLOUDINARY_FOLDER =
    window.VIEWORA_CLOUDINARY_FOLDER ||
    "";

console.log(
    "☁️ Cloudinary:",
    window.VIEWORA_CLOUDINARY_CLOUD,
    "/",
    window.VIEWORA_CLOUDINARY_PRESET
);
