"use strict";

console.clear();
console.log("%cVIEWORA PREMIUM MESSAGES V13", "color:#00E5FF;font-size:18px;font-weight:bold");

if (typeof firebase === "undefined") throw new Error("Firebase SDK Not Loaded");
if (typeof auth === "undefined") throw new Error("Firebase Auth Missing");
if (typeof db === "undefined") throw new Error("Realtime Database Missing");

// ====================== GLOBALS ======================
let currentUser = null;
let currentUID = null;
let currentUserData = null;
let chats = [];
let filteredChats = [];
let initialized = false;
let chatListener = null;
let unreadListener = null;
let currentFilter = "all";

// ====================== DOM ======================
const loadingOverlay = document.getElementById("loadingOverlay");
const chatList = document.getElementById("chatList");
const chatSkeleton = document.getElementById("chatSkeleton");
const emptyChats = document.getElementById("emptyChats");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const newChatBtn = document.getElementById("newChatBtn");
const newMessageFab = document.getElementById("newMessageFab");
const startChatBtn = document.getElementById("startChatBtn");
const messageBadge = document.getElementById("messageBadge");
const connectionStatus = document.getElementById("connectionStatus");
const newChatModal = document.getElementById("newChatModal");
const closeNewChat = document.getElementById("closeNewChat");
const newChatSearch = document.getElementById("newChatSearch");
const newChatUserList = document.getElementById("newChatUserList");
const usersLoading = document.getElementById("usersLoading");
const emptyUsers = document.getElementById("emptyUsers");

// ====================== LOADER ======================
function showLoader() {
    loadingOverlay?.classList.remove("hidden");
}
function hideLoader() {
    loadingOverlay?.classList.add("hidden");
}
function showSkeleton() {
    chatSkeleton?.classList.remove("hidden");
}
function hideSkeleton() {
    chatSkeleton?.classList.add("hidden");
}

// ====================== TOAST ======================
function showToast(text) {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");
    if (!toast || !toastText) return;

    toastText.textContent = text || "";
    toast.classList.remove("hidden");

    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(function () {
        toast.classList.add("hidden");
    }, 2500);
}

// ====================== NETWORK ======================
function updateConnectionStatus() {
    if (!connectionStatus) return;
    connectionStatus.innerHTML = navigator.onLine ? "🟢 Online" : "🔴 Offline";
}
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

// ====================== AUTH ======================
auth.onAuthStateChanged(async function (user) {
    if (!user) {
        location.replace("login.html");
        return;
    }

    currentUser = user;
    currentUID = user.uid;
    console.log("Logged In :", currentUID);
    updateConnectionStatus();
    await initializeMessages();
});

// ====================== INIT ======================
async function initializeMessages() {
    if (initialized) return;
    initialized = true;

    showLoader();
    showSkeleton();

    try {
        await loadCurrentUser();
        listenChats();
        listenUnreadCount();

        hideSkeleton();
        hideLoader();

        var app = document.getElementById("app");
        if (app) app.classList.remove("hidden");

        console.log("Messages Ready");
    } catch (error) {
        console.error(error);
        hideLoader();
        showToast("Unable to load messages");
    }
}

// ====================== LOAD USER ======================
async function loadCurrentUser() {
    try {
        var snapshot = await db.ref("users/" + currentUID).once("value");

        if (!snapshot.exists()) {
            showToast("Profile not found");
            return;
        }

        currentUserData = snapshot.val();

        db.ref("users/" + currentUID).update({
            online: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });

        db.ref("users/" + currentUID).onDisconnect().update({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (error) {
        console.error(error);
        showToast("Unable to load profile");
    }
}

// ====================== HELPERS ======================
function formatTime(time) {
    if (!time) return "";
    return new Date(time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ====================== LISTEN CHATS ======================
function listenChats() {
    if (!currentUID) return;

    if (chatListener) {
        db.ref("userChats/" + currentUID).off("value", chatListener);
    }

    chatListener = function (snapshot) {
        chats = [];

        if (snapshot.exists()) {
            snapshot.forEach(function (child) {
                var chat = child.val();
                chat.chatId = child.key;
                chats.push(chat);
            });
        }

        sortChats();
        renderChats();
    };

    db.ref("userChats/" + currentUID).on("value", chatListener);
}

function sortChats() {
    chats.sort(function (a, b) {
        return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });
    filteredChats = chats.slice();
}

// ====================== RENDER ======================
function renderChats() {
    if (!chatList) return;

    chatList.innerHTML = "";

    if (filteredChats.length === 0) {
        chatList.classList.add("hidden");
        if (emptyChats) emptyChats.classList.remove("hidden");
        return;
    }

    if (emptyChats) emptyChats.classList.add("hidden");
    chatList.classList.remove("hidden");

    filteredChats.forEach(function (chat) {
        chatList.appendChild(createChatCard(chat));
    });

    animateChatCards();
}

function createChatCard(chat) {
    var card = document.createElement("div");
    card.className = "chatCard";
    card.dataset.chatid = chat.chatId;

    if (Number(chat.unread || 0) > 0) {
        card.classList.add("unread");
    }

    var photo = chat.photoURL || chat.profilePhoto || "assets/default-avatar.png";
    var unread = Number(chat.unread || 0);

    card.innerHTML =
        '<div class="chatAvatar">' +
            '<img src="' + photo + '" alt="User" onerror="this.src=\'assets/default-avatar.png\'">' +
            (chat.online ? '<span class="onlineDot"></span>' : '') +
        '</div>' +
        '<div class="chatInfo">' +
            '<div class="chatTop">' +
                '<h3 class="chatName">' + (chat.name || "Unknown User") + '</h3>' +
                '<span class="chatTime">' + formatTime(chat.lastMessageTime) + '</span>' +
            '</div>' +
            '<div class="chatBottom">' +
                '<p class="chatPreview">' + (chat.lastMessage || "Start chatting...") + '</p>' +
                (unread > 0 ? '<div class="unreadBadge">' + unread + '</div>' : '') +
            '</div>' +
        '</div>';

    card.onclick = function () {
        location.href = "chat.html?uid=" + chat.userId;
    };

    return card;
}

let hasAnimated = false;

function animateChatCards() {
    if (hasAnimated) {
        // Already animated → just show without animation
        document.querySelectorAll(".chatCard").forEach(function (card) {
            card.classList.add("show");
            card.style.opacity = "1";
            card.style.transform = "none";
        });
        return;
    }

    hasAnimated = true;

    document.querySelectorAll(".chatCard").forEach(function (card, i) {
        setTimeout(function () {
            card.classList.add("show");
        }, i * 40);
    });
}

// ====================== UNREAD ======================
function listenUnreadCount() {
    if (!currentUID) return;

    unreadListener = db.ref("userChats/" + currentUID);
    unreadListener.on("value", function (snapshot) {
        var total = 0;

        if (snapshot.exists()) {
            snapshot.forEach(function (child) {
                total += Number(child.val().unread || 0);
            });
        }

        if (messageBadge) {
            if (total > 0) {
                messageBadge.textContent = total > 99 ? "99+" : total;
                messageBadge.classList.remove("hidden");
            } else {
                messageBadge.classList.add("hidden");
            }
        }

        var unreadBadge = document.getElementById("unreadBadge");
        if (unreadBadge) {
            if (total > 0) {
                unreadBadge.textContent = total;
                unreadBadge.classList.remove("hidden");
            } else {
                unreadBadge.classList.add("hidden");
            }
        }
    });
}

// ====================== SEARCH ======================
if (searchInput) {
    searchInput.addEventListener("input", function () {
        var keyword = searchInput.value.toLowerCase().trim();

        if (!keyword) {
            filteredChats = chats.slice();
            if (clearSearch) clearSearch.classList.add("hidden");
        } else {
            if (clearSearch) clearSearch.classList.remove("hidden");
            filteredChats = chats.filter(function (c) {
                return (
                    (c.name || "").toLowerCase().includes(keyword) ||
                    (c.username || "").toLowerCase().includes(keyword) ||
                    (c.lastMessage || "").toLowerCase().includes(keyword)
                );
            });
        }
        applyFilter();
    });
}

if (clearSearch) {
    clearSearch.addEventListener("click", function () {
        searchInput.value = "";
        filteredChats = chats.slice();
        clearSearch.classList.add("hidden");
        applyFilter();
    });
}

// ====================== FILTERS ======================
document.querySelectorAll(".filterChip").forEach(function (chip) {
    chip.onclick = function () {
        document.querySelectorAll(".filterChip").forEach(function (b) {
            b.classList.remove("active");
        });
        chip.classList.add("active");
        currentFilter = chip.dataset.filter;
        applyFilter();
    };
});

function applyFilter() {
    var list = filteredChats.slice();

    if (currentFilter === "online") {
        list = list.filter(function (c) { return c.online === true; });
    }
    if (currentFilter === "unread") {
        list = list.filter(function (c) { return Number(c.unread || 0) > 0; });
    }
    if (currentFilter === "groups") {
        list = list.filter(function (c) { return c.type === "group"; });
    }

    chatList.innerHTML = "";

    if (list.length === 0) {
        chatList.classList.add("hidden");
        if (emptyChats) emptyChats.classList.remove("hidden");
        return;
    }

    if (emptyChats) emptyChats.classList.add("hidden");
    chatList.classList.remove("hidden");

    list.forEach(function (c) {
        chatList.appendChild(createChatCard(c));
    });

    animateChatCards();
}

function refreshChats() {
    sortChats();
    var keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";

    if (keyword) {
        filteredChats = chats.filter(function (c) {
            return (
                (c.name || "").toLowerCase().includes(keyword) ||
                (c.username || "").toLowerCase().includes(keyword) ||
                (c.lastMessage || "").toLowerCase().includes(keyword)
            );
        });
    } else {
        filteredChats = chats.slice();
    }
    applyFilter();
}

// ====================== LIVE UPDATES ======================
function setupLiveUpdates() {
    if (!currentUID) return;

    db.ref("userChats/" + currentUID).on("child_changed", function (snap) {
        var chat = snap.val();
        chat.chatId = snap.key;

        // Sirf online + unread update karo, full re-render mat karo
        updateOnlineStatus(chat.chatId, chat.online);
        updateUnreadBadge(chat.chatId, Number(chat.unread || 0));

        // Full refresh sirf zarurat padne par
        // refreshChats();   ← is line ko comment kar do
    });
}

function updateOnlineStatus(chatId, online) {
    var card = document.querySelector('[data-chatid="' + chatId + '"]');
    if (!card) return;

    var avatar = card.querySelector(".chatAvatar");
    var dot = avatar.querySelector(".onlineDot");

    if (online && !dot) {
        dot = document.createElement("span");
        dot.className = "onlineDot";
        avatar.appendChild(dot);
    } else if (!online && dot) {
        dot.remove();
    }
}

function updateUnreadBadge(chatId, unread) {
    var card = document.querySelector('[data-chatid="' + chatId + '"]');
    if (!card) return;

    var bottom = card.querySelector(".chatBottom");
    var badge = bottom.querySelector(".unreadBadge");

    if (unread > 0) {
        card.classList.add("unread");
        if (!badge) {
            badge = document.createElement("div");
            badge.className = "unreadBadge";
            bottom.appendChild(badge);
        }
        badge.textContent = unread;
    } else {
        card.classList.remove("unread");
        if (badge) badge.remove();
    }
}

// ====================== MODAL ======================
function openNewChat() {
    if (!newChatModal) return;
    newChatModal.classList.remove("hidden");
    requestAnimationFrame(function () {
        newChatModal.classList.add("show");
    });
    loadUsers();
}

function closeModal() {
    if (!newChatModal) return;
    newChatModal.classList.remove("show");
    setTimeout(function () {
        newChatModal.classList.add("hidden");
    }, 280);
}

if (newChatBtn) newChatBtn.addEventListener("click", openNewChat);
if (newMessageFab) newMessageFab.addEventListener("click", openNewChat);
if (startChatBtn) startChatBtn.addEventListener("click", openNewChat);
if (closeNewChat) closeNewChat.addEventListener("click", closeModal);

if (newChatModal) {
    newChatModal.addEventListener("click", function (e) {
        if (e.target === newChatModal || e.target.classList.contains("modalOverlay")) {
            closeModal();
        }
    });
}

if (newChatSearch) {
    newChatSearch.addEventListener("input", function () {
        loadUsers(newChatSearch.value.trim());
    });
}

// ====================== USERS ======================
async function loadUsers(keyword) {
    keyword = keyword || "";
    if (usersLoading) usersLoading.classList.remove("hidden");
    if (emptyUsers) emptyUsers.classList.add("hidden");
    if (newChatUserList) newChatUserList.innerHTML = "";

    try {
        var snap = await db.ref("users").once("value");
        if (usersLoading) usersLoading.classList.add("hidden");

        if (!snap.exists()) {
            if (emptyUsers) emptyUsers.classList.remove("hidden");
            return;
        }

        var count = 0;

        snap.forEach(function (child) {
            var uid = child.key;
            var user = child.val();

            if (uid === currentUID) return;

            var match = !keyword ||
                (user.name || "").toLowerCase().includes(keyword.toLowerCase()) ||
                (user.username || "").toLowerCase().includes(keyword.toLowerCase());

            if (!match) return;

            count++;
            if (newChatUserList) {
                newChatUserList.appendChild(createUserCard(uid, user));
            }
        });

        if (count === 0 && emptyUsers) {
            emptyUsers.classList.remove("hidden");
        }
    } catch (err) {
        console.error(err);
        if (usersLoading) usersLoading.classList.add("hidden");
        showToast("Unable to load users");
    }
}

function createUserCard(uid, user) {
    var card = document.createElement("div");
    card.className = "userCard";

    var photo = user.photoURL || user.profilePhoto || "assets/default-avatar.png";

    card.innerHTML =
        '<div class="userAvatar">' +
            '<img src="' + photo + '" onerror="this.src=\'assets/default-avatar.png\'">' +
            (user.online ? '<span class="onlineDot"></span>' : '') +
        '</div>' +
        '<div class="userDetails">' +
            '<h3>' + (user.name || "Unknown") + '</h3>' +
            '<p>@' + (user.username || "user") + '</p>' +
        '</div>' +
        '<button class="startChatBtn">Chat</button>';

    var btn = card.querySelector(".startChatBtn");
    if (btn) {
        btn.onclick = function (e) {
            e.stopPropagation();
            createChat(uid, user);
        };
    }

    card.onclick = function () {
        createChat(uid, user);
    };

    return card;
}

// ====================== CREATE CHAT ======================
async function createChat(otherUid, user) {
    try {
        showLoader();

        var chatId = [currentUID, otherUid].sort().join("_");
        var chatRef = db.ref("chats/" + chatId);
        var chatSnap = await chatRef.once("value");

        if (!chatSnap.exists()) {
            await chatRef.set({
                type: "private",
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                members: {
                    [currentUID]: true,
                    [otherUid]: true
                }
            });
        }

        await db.ref("userChats/" + currentUID + "/" + chatId).update({
            chatId: chatId,
            userId: otherUid,
            name: user.name || "Unknown",
            username: user.username || "",
            photoURL: user.photoURL || user.profilePhoto || "",
            lastMessage: "",
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
            unread: 0,
            online: user.online || false
        });

        var mySnap = await db.ref("users/" + currentUID).once("value");
        var me = mySnap.val() || {};

        await db.ref("userChats/" + otherUid + "/" + chatId).update({
            chatId: chatId,
            userId: currentUID,
            name: me.name || "Unknown",
            username: me.username || "",
            photoURL: me.photoURL || me.profilePhoto || "",
            lastMessage: "",
            lastMessageTime: firebase.database.ServerValue.TIMESTAMP,
            unread: 0,
            online: true
        });

        hideLoader();
        closeModal();
        showToast("Opening Chat...");

        setTimeout(function () {
            location.href = "chat.html?uid=" + otherUid;
        }, 250);

    } catch (error) {
        console.error(error);
        hideLoader();
        showToast("Failed to create chat");
    }
}

// ====================== REFRESH ======================
var refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
        refreshChats();
        showToast("Chats refreshed");
    });
}

window.addEventListener("focus", function () {
    refreshChats();
});

// ====================== CLEANUP ======================
window.addEventListener("beforeunload", function () {
    if (chatListener && currentUID) {
        db.ref("userChats/" + currentUID).off("value", chatListener);
    }
    if (unreadListener && currentUID) {
        db.ref("userChats/" + currentUID).off("value", unreadListener);
    }
});

// Start live updates after auth
auth.onAuthStateChanged(function (user) {
    if (user) {
        setTimeout(setupLiveUpdates, 1000);
    }
});

console.log("%cVIEWORA PREMIUM MESSAGES V13 READY", "color:#00E676;font-size:18px;font-weight:bold");