/* =========================================================
   VIEWORA • USERS.JS
   Clean Firebase Users + Search + Follow System
========================================================= */

(() => {

    "use strict";

    /* =====================================================
       GLOBAL STATE
    ====================================================== */

    let allUsers = [];
    let currentUser = null;
    let selectedUser = null;
    let currentFilter = "all";


    /* =====================================================
       DEFAULT IMAGE
    ====================================================== */

    const DEFAULT_AVATAR =
        "assets/default-avatar.png";


    /* =====================================================
       DOM
    ====================================================== */

    const searchInput =
        document.getElementById("searchInput");

    const usersList =
        document.getElementById("usersList");

    const suggestedUsers =
        document.getElementById("suggestedUsers");

    const onlineUsers =
        document.getElementById("onlineUsers");

    const totalUsers =
        document.getElementById("totalUsers");

    const totalUsersLabel =
        document.getElementById("totalUsersLabel");

    const onlineCount =
        document.getElementById("onlineCount");

    const onlineCountText =
        document.getElementById("onlineCountText");

    const emptyState =
        document.getElementById("emptyState");

    const usersSkeleton =
        document.getElementById("usersSkeleton");

    const profileModal =
        document.getElementById("profileModal");

    const modalOverlay =
        document.getElementById("modalOverlay");

    const closeModal =
        document.getElementById("closeModal");

    const modalAvatar =
        document.getElementById("modalAvatar");

    const modalName =
        document.getElementById("modalName");

    const modalUsername =
        document.getElementById("modalUsername");

    const modalBio =
        document.getElementById("modalBio");

    const modalPosts =
        document.getElementById("modalPosts");

    const modalFollowers =
        document.getElementById("modalFollowers");

    const modalFollowing =
        document.getElementById("modalFollowing");

    const followBtn =
        document.getElementById("followBtn");

    const messageBtn =
        document.getElementById("messageBtn");

    const refreshBtn =
        document.getElementById("refreshBtn");

    const backBtn =
        document.getElementById("backBtn");

    const scrollTopBtn =
        document.getElementById("scrollTopBtn");

    const addFriendBtn =
        document.getElementById("addFriendBtn");

    const toast =
        document.getElementById("toast");

    const toastText =
        document.getElementById("toastText");

    const toastIcon =
        document.getElementById("toastIcon");


    /* =====================================================
       FIREBASE
    ====================================================== */

    function getDatabase() {

        if (
            typeof firebase === "undefined" ||
            !firebase.apps ||
            !firebase.apps.length
        ) {

            console.error(
                "Firebase is not initialized."
            );

            return null;
        }

        return firebase.database();
    }


    const db = getDatabase();


    /*
     * IMPORTANT:
     * usersRef is declared ONLY ONCE.
     */

    const usersRef =
        db
            ? db.ref("users")
            : null;


    /* =====================================================
       AUTH
    ====================================================== */

    function getCurrentUser() {

        if (
            typeof firebase === "undefined" ||
            !firebase.auth
        ) {

            return null;
        }

        return firebase.auth().currentUser;
    }


    /* =====================================================
       TOAST
    ====================================================== */

    function showToast(
        message,
        success = true
    ) {

        if (!toast || !toastText) {
            return;
        }

        toastText.textContent =
            message;


        if (toastIcon) {

            toastIcon.className =
                success
                    ? "fa-solid fa-circle-check"
                    : "fa-solid fa-circle-exclamation";

        }


        toast.classList.remove(
            "hidden"
        );

        toast.classList.add(
            "show"
        );


        clearTimeout(
            window.vieworaToastTimer
        );


        window.vieworaToastTimer =
            setTimeout(() => {

                toast.classList.remove(
                    "show"
                );

                setTimeout(() => {

                    toast.classList.add(
                        "hidden"
                    );

                }, 300);

            }, 2200);

    }


    /* =====================================================
       ESCAPE HTML
    ====================================================== */

    function escapeHTML(value) {

        if (
            value === undefined ||
            value === null
        ) {

            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       USER HELPERS
    ====================================================== */

    function getUserId(user) {

        return (
            user.uid ||
            user.id ||
            user.userId ||
            ""
        );
    }


    function getUserName(user) {

        return (
            user.name ||
            user.displayName ||
            user.fullName ||
            "Viewora User"
        );
    }


    function getUsername(user) {

        return (
            user.username ||
            user.userName ||
            user.handle ||
            "username"
        ).replace(/^@/, "");
    }


    function getAvatar(user) {

        return (
            user.photoURL ||
            user.photoUrl ||
            user.avatar ||
            user.profilePhoto ||
            user.profileImage ||
            DEFAULT_AVATAR
        );
    }


    function getBio(user) {

        return (
            user.bio ||
            "Welcome to Viewora 🚀"
        );
    }


    function isOnline(user) {

        return (
            user.online === true ||
            user.isOnline === true ||
            user.status === "online"
        );
    }


    function isCreator(user) {

        return (
            user.isCreator === true ||
            user.creator === true ||
            user.role === "creator"
        );
    }


    /* =====================================================
       PRIVATE PROFILE
    ====================================================== */

    function isPrivateUser(user) {

        return (
            user.private === true ||
            user.isPrivate === true ||
            user.profilePrivate === true ||
            user.privacy === "private" ||
            user.profileVisibility === "private"
        );
    }


    /* =====================================================
       NORMALIZE USERS
    ====================================================== */

    function normalizeUsers(snapshot) {

        const result = [];

        snapshot.forEach(child => {

            const data =
                child.val() || {};

            result.push({

                ...data,

                uid:
                    data.uid ||
                    child.key

            });

        });

        return result;
    }


    /* =====================================================
       LOAD USERS
    ====================================================== */

    async function loadUsers() {

        if (!usersRef) {

            hideSkeleton();

            showToast(
                "Firebase database is not connected.",
                false
            );

            return;
        }


        showSkeleton();


        try {

            const snapshot =
                await usersRef.once("value");


            allUsers =
                normalizeUsers(snapshot);


            currentUser =
                getCurrentUser();


            updateStats();

            renderSuggested();

            renderOnline();

            renderUsers();


        } catch (error) {

            console.error(
                "Viewora users loading error:",
                error
            );

            showToast(
                "Unable to load users.",
                false
            );


        } finally {

            hideSkeleton();

        }

    }


    /* =====================================================
       STATS
    ====================================================== */

    function updateStats() {

        const online =
            allUsers.filter(isOnline);


        if (totalUsers) {

            totalUsers.textContent =
                String(allUsers.length);

        }


        if (totalUsersLabel) {

            totalUsersLabel.textContent =
                `${allUsers.length} Users`;

        }


        if (onlineCount) {

            onlineCount.textContent =
                String(online.length);

        }


        if (onlineCountText) {

            onlineCountText.textContent =
                `${online.length} Online`;

        }

    }


    /* =====================================================
       USER CARD
    ====================================================== */

    function createUserCard(
        user,
        compact = false
    ) {

        const uid =
            getUserId(user);

        const name =
            getUserName(user);

        const username =
            getUsername(user);

        const avatar =
            getAvatar(user);

        const bio =
            getBio(user);

        const online =
            isOnline(user);

        const creator =
            isCreator(user);


        return `

            <article
                class="userCard ${compact ? "compactCard" : ""}"
                data-user-id="${escapeHTML(uid)}"
            >

                <button
                    type="button"
                    class="userCardMain"
                    data-action="profile"
                    data-user-id="${escapeHTML(uid)}"
                >

                    <div class="userAvatarWrap">

                        <img
                            class="userAvatar"
                            src="${escapeHTML(avatar)}"
                            alt="${escapeHTML(name)}"
                            loading="lazy"
                            onerror="this.src='${DEFAULT_AVATAR}'"
                        >

                        ${
                            online
                                ? `
                                    <span
                                        class="userOnlineDot"
                                    ></span>
                                `
                                : ""
                        }

                    </div>


                    <div class="userInfo">

                        <div class="userNameRow">

                            <strong>
                                ${escapeHTML(name)}
                            </strong>

                            ${
                                creator
                                    ? `
                                        <span
                                            class="creatorBadge"
                                            title="Creator"
                                        >
                                            <i
                                                class="fa-solid fa-star"
                                            ></i>
                                        </span>
                                    `
                                    : ""
                            }

                        </div>


                        <span
                            class="userUsername"
                        >
                            @${escapeHTML(username)}
                        </span>


                        ${
                            !compact
                                ? `
                                    <p class="userBio">
                                        ${escapeHTML(bio)}
                                    </p>
                                `
                                : ""
                        }

                    </div>

                </button>


                ${
                    currentUser &&
                    uid &&
                    uid !== currentUser.uid
                        ? `
                            <button
                                type="button"
                                class="cardFollowBtn"
                                data-action="follow"
                                data-user-id="${escapeHTML(uid)}"
                            >
                                <span>Follow</span>
                            </button>
                        `
                        : ""
                }

            </article>

        `;

    }


    /* =====================================================
       SUGGESTED
    ====================================================== */

    function renderSuggested() {

        if (!suggestedUsers) {
            return;
        }


        const myUid =
            currentUser?.uid || "";


        const users =
            allUsers
                .filter(
                    user =>
                        getUserId(user) !== myUid
                )
                .slice(0, 6);


        if (!users.length) {

            suggestedUsers.innerHTML = `

                <div class="noUsersMessage">

                    No suggestions available yet.

                </div>

            `;

            return;
        }


        suggestedUsers.innerHTML =
            users
                .map(
                    user =>
                        createUserCard(
                            user,
                            true
                        )
                )
                .join("");


        refreshFollowButtons();

    }


    /* =====================================================
       ONLINE
    ====================================================== */

    function renderOnline() {

        if (!onlineUsers) {
            return;
        }


        const myUid =
            currentUser?.uid || "";


        const users =
            allUsers
                .filter(user => {

                    return (
                        isOnline(user) &&
                        getUserId(user) !== myUid
                    );

                })
                .slice(0, 10);


        if (!users.length) {

            onlineUsers.innerHTML = `

                <div class="noUsersMessage">

                    <i
                        class="fa-regular fa-moon"
                    ></i>

                    No one is online right now.

                </div>

            `;

            return;
        }


        onlineUsers.innerHTML =
            users
                .map(
                    user =>
                        createUserCard(
                            user,
                            true
                        )
                )
                .join("");


        refreshFollowButtons();

    }


    /* =====================================================
       ALL USERS
    ====================================================== */

    function renderUsers() {

        if (!usersList) {
            return;
        }


        const search =
            (
                searchInput?.value ||
                ""
            )
                .trim()
                .toLowerCase();


        const users =
            allUsers.filter(user => {

                const uid =
                    getUserId(user);


                if (
                    currentUser &&
                    uid === currentUser.uid
                ) {

                    return false;

                }


                const name =
                    getUserName(user)
                        .toLowerCase();


                const username =
                    getUsername(user)
                        .toLowerCase();


                const bio =
                    getBio(user)
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    name.includes(search) ||
                    username.includes(search) ||
                    bio.includes(search);


                if (!matchesSearch) {
                    return false;
                }


                if (
                    currentFilter === "online" &&
                    !isOnline(user)
                ) {

                    return false;

                }


                if (
                    currentFilter === "creators" &&
                    !isCreator(user)
                ) {

                    return false;

                }


                return true;

            });


        if (!users.length) {

            usersList.innerHTML = "";


            if (emptyState) {

                emptyState.classList.remove(
                    "hidden"
                );

            }

            return;
        }


        if (emptyState) {

            emptyState.classList.add(
                "hidden"
            );

        }


        usersList.innerHTML =
            users
                .map(user =>
                    createUserCard(user)
                )
                .join("");


        refreshFollowButtons();

    }


    /* =====================================================
       FOLLOW REFERENCES
    ====================================================== */

    function followingPath(uid) {

        if (
            !currentUser ||
            !uid ||
            !db
        ) {

            return null;
        }


        return db.ref(
            `users/${currentUser.uid}/following/${uid}`
        );

    }


    function followerPath(uid) {

        if (
            !currentUser ||
            !uid ||
            !db
        ) {

            return null;
        }


        return db.ref(
            `users/${uid}/followers/${currentUser.uid}`
        );

    }


    /* =====================================================
       CHECK FOLLOWING
    ====================================================== */

    async function isFollowing(uid) {

        if (
            !currentUser ||
            !uid ||
            uid === currentUser.uid
        ) {

            return false;
        }


        try {

            const ref =
                followingPath(uid);


            if (!ref) {
                return false;
            }


            const snapshot =
                await ref.once("value");


            return snapshot.exists();


        } catch (error) {

            console.error(
                "Follow check error:",
                error
            );

            return false;

        }

    }


    /* =====================================================
       FOLLOW BUTTON UI
    ====================================================== */

    function setFollowButtonState(
        uid,
        following
    ) {

        document
            .querySelectorAll(
                `[data-action="follow"][data-user-id="${CSS.escape(uid)}"]`
            )
            .forEach(button => {

                button.classList.toggle(
                    "following",
                    following
                );


                button.innerHTML =
                    following
                        ? `
                            <i
                                class="fa-solid fa-check"
                            ></i>

                            <span>
                                Following
                            </span>
                        `
                        : `
                            <span>
                                Follow
                            </span>
                        `;

            });


        if (
            selectedUser &&
            getUserId(selectedUser) === uid &&
            followBtn
        ) {

            followBtn.classList.toggle(
                "following",
                following
            );


            followBtn.innerHTML =
                following
                    ? `
                        <i
                            class="fa-solid fa-check"
                        ></i>

                        <span>
                            Following
                        </span>
                    `
                    : `
                        <i
                            class="fa-solid fa-user-plus"
                        ></i>

                        <span>
                            Follow
                        </span>
                    `;

        }

    }


    /* =====================================================
       REFRESH FOLLOW BUTTONS
    ====================================================== */

    async function refreshFollowButtons() {

        if (!currentUser) {
            return;
        }


        const buttons =
            document.querySelectorAll(
                '[data-action="follow"]'
            );


        for (const button of buttons) {

            const uid =
                button.dataset.userId;


            if (!uid) {
                continue;
            }


            const following =
                await isFollowing(uid);


            setFollowButtonState(
                uid,
                following
            );

        }

    }


    /* =====================================================
       FOLLOW / UNFOLLOW
    ====================================================== */

    async function toggleFollow(
        uid,
        button = null
    ) {

        if (!currentUser) {

            showToast(
                "Please login first.",
                false
            );

            return;
        }


        if (
            !uid ||
            uid === currentUser.uid
        ) {

            return;
        }


        if (button) {

            button.disabled = true;

        }


        try {

            const followingRef =
                followingPath(uid);

            const followerRef =
                followerPath(uid);


            if (
                !followingRef ||
                !followerRef
            ) {

                throw new Error(
                    "Follow reference unavailable"
                );

            }


            const snapshot =
                await followingRef.once(
                    "value"
                );


            const alreadyFollowing =
                snapshot.exists();


            /* =========================================
               UNFOLLOW
            ========================================== */

            if (alreadyFollowing) {

                await Promise.all([

                    followingRef.remove(),

                    followerRef.remove()

                ]);


                setFollowButtonState(
                    uid,
                    false
                );


                showToast(
                    "Unfollowed"
                );


            }

            /* =========================================
               FOLLOW
            ========================================== */

            else {

                const timestamp =
                    firebase.database
                        .ServerValue
                        .TIMESTAMP;


                await Promise.all([

                    followingRef.set({
                        uid: uid,
                        followedAt: timestamp
                    }),

                    followerRef.set({
                        uid:
                            currentUser.uid,
                        followedAt:
                            timestamp
                    })

                ]);


                setFollowButtonState(
                    uid,
                    true
                );


                showToast(
                    "Following"
                );

            }


            await updateFollowerCount(
                uid,
                !alreadyFollowing
            );


            /*
             * Update modal message permission
             */

            if (
                selectedUser &&
                getUserId(selectedUser) === uid
            ) {

                updateMessageButton();

            }


        } catch (error) {

            console.error(
                "Follow error:",
                error
            );


            showToast(
                "Couldn't update follow.",
                false
            );


        } finally {

            if (button) {

                button.disabled = false;

            }

        }

    }


    /* =====================================================
       FOLLOWER COUNT
    ====================================================== */

    async function updateFollowerCount(
        uid,
        increment
    ) {

        try {

            const ref =
                db.ref(
                    `users/${uid}/followersCount`
                );


            await ref.transaction(
                current => {

                    const value =
                        Number(current || 0);


                    return increment
                        ? value + 1
                        : Math.max(
                            0,
                            value - 1
                        );

                }
            );


        } catch (error) {

            console.warn(
                "Follower count update failed:",
                error
            );

        }

    }


    /* =====================================================
       MESSAGE PERMISSION
    ====================================================== */

    async function updateMessageButton() {

        if (
            !selectedUser ||
            !messageBtn
        ) {

            return;
        }


        const uid =
            getUserId(selectedUser);


        /* Own profile */

        if (
            currentUser &&
            uid === currentUser.uid
        ) {

            messageBtn.style.display =
                "none";

            return;

        }


        const privateProfile =
            isPrivateUser(
                selectedUser
            );


        const following =
            await isFollowing(uid);


        /*
         * PUBLIC:
         * Message available.
         */

        if (!privateProfile) {

            messageBtn.style.display =
                "inline-flex";

            return;

        }


        /*
         * PRIVATE:
         * Message only after following.
         */

        if (following) {

            messageBtn.style.display =
                "inline-flex";

        } else {

            messageBtn.style.display =
                "none";

        }

    }


    /* =====================================================
       OPEN PROFILE
    ====================================================== */

    async function openProfile(uid) {

        const user =
            allUsers.find(
                item =>
                    getUserId(item) === uid
            );


        if (
            !user ||
            !profileModal
        ) {

            return;

        }


        selectedUser =
            user;


        const avatar =
            getAvatar(user);

        const name =
            getUserName(user);

        const username =
            getUsername(user);

        const bio =
            getBio(user);


        const followers =
            Number(
                user.followersCount ||
                (
                    user.followers
                        ? Object.keys(
                            user.followers
                        ).length
                        : 0
                )
            );


        const following =
            Number(
                user.followingCount ||
                (
                    user.following
                        ? Object.keys(
                            user.following
                        ).length
                        : 0
                )
            );


        const posts =
            Number(
                user.postsCount ||
                user.postCount ||
                0
            );


        if (modalAvatar) {

            modalAvatar.src =
                avatar;

        }


        if (modalName) {

            modalName.textContent =
                name;

        }


        if (modalUsername) {

            modalUsername.textContent =
                `@${username}`;

        }


        if (modalBio) {

            modalBio.textContent =
                bio;

        }


        if (modalPosts) {

            modalPosts.textContent =
                posts;

        }


        if (modalFollowers) {

            modalFollowers.textContent =
                followers;

        }


        if (modalFollowing) {

            modalFollowing.textContent =
                following;

        }


        profileModal.classList.remove(
            "hidden"
        );

        profileModal.classList.add(
            "show"
        );


        document.body.classList.add(
            "modalOpen"
        );


        /* =============================================
           OWN PROFILE
        ============================================== */

        if (
            currentUser &&
            uid === currentUser.uid
        ) {

            if (followBtn) {

                followBtn.style.display =
                    "none";

            }


            if (messageBtn) {

                messageBtn.style.display =
                    "none";

            }


            return;
        }


        /* =============================================
           FOLLOW STATE
        ============================================== */

        const followingState =
            await isFollowing(uid);


        setFollowButtonState(
            uid,
            followingState
        );


        if (followBtn) {

            followBtn.style.display =
                "inline-flex";

        }


        /* =============================================
           MESSAGE STATE
        ============================================== */

        await updateMessageButton();

    }


    /* =====================================================
       CLOSE PROFILE
    ====================================================== */

    function closeProfile() {

        if (!profileModal) {
            return;
        }


        profileModal.classList.remove(
            "show"
        );


        setTimeout(() => {

            profileModal.classList.add(
                "hidden"
            );

        }, 200);


        document.body.classList.remove(
            "modalOpen"
        );


        selectedUser =
            null;

    }


    /* =====================================================
       GLOBAL CLICK HANDLER
    ====================================================== */

    document.addEventListener(
        "click",
        event => {

            const follow =
                event.target.closest(
                    '[data-action="follow"]'
                );


            if (follow) {

                event.preventDefault();

                event.stopPropagation();


                const uid =
                    follow.dataset.userId;


                toggleFollow(
                    uid,
                    follow
                );


                return;
            }


            const profile =
                event.target.closest(
                    '[data-action="profile"]'
                );


            if (profile) {

                event.preventDefault();


                const uid =
                    profile.dataset.userId;


                openProfile(uid);

            }

        }
    );


    /* =====================================================
       MODAL FOLLOW
    ====================================================== */

    if (followBtn) {

        followBtn.addEventListener(
            "click",
            async () => {

                if (!selectedUser) {
                    return;
                }


                const uid =
                    getUserId(
                        selectedUser
                    );


                await toggleFollow(
                    uid,
                    followBtn
                );

            }
        );

    }


    /* =====================================================
       MESSAGE
    ====================================================== */

    if (messageBtn) {

        messageBtn.addEventListener(
            "click",
            async () => {

                if (!selectedUser) {
                    return;
                }


                const uid =
                    getUserId(
                        selectedUser
                    );


                if (
                    !currentUser ||
                    !uid ||
                    uid === currentUser.uid
                ) {

                    return;
                }


                /*
                 * Private profile:
                 * must follow first.
                 */

                if (
                    isPrivateUser(
                        selectedUser
                    )
                ) {

                    const following =
                        await isFollowing(
                            uid
                        );


                    if (!following) {

                        showToast(
                            "Follow this user to message them.",
                            false
                        );

                        return;
                    }

                }


                window.location.href =
                    `messages.html?user=${encodeURIComponent(uid)}`;

            }
        );

    }


    /* =====================================================
       CLOSE MODAL
    ====================================================== */

    if (closeModal) {

        closeModal.addEventListener(
            "click",
            closeProfile
        );

    }


    if (modalOverlay) {

        modalOverlay.addEventListener(
            "click",
            closeProfile
        );

    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeProfile();

            }

        }
    );


    /* =====================================================
       SEARCH
    ====================================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderUsers
        );

    }


    /* =====================================================
       FILTER
    ====================================================== */

    document
        .querySelectorAll(
            ".filterBtn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".filterBtn"
                        )
                        .forEach(btn =>
                            btn.classList.remove(
                                "active"
                            )
                        );


                    button.classList.add(
                        "active"
                    );


                    currentFilter =
                        button.dataset.filter ||
                        "all";


                    renderUsers();

                }
            );

        });


    /* =====================================================
       BACK
    ====================================================== */

    if (backBtn) {

        backBtn.addEventListener(
            "click",
            () => {

                if (
                    window.history.length > 1
                ) {

                    window.history.back();

                } else {

                    window.location.href =
                        "index.html";

                }

            }
        );

    }


    /* =====================================================
       REFRESH
    ====================================================== */

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            async () => {

                refreshBtn.classList.add(
                    "rotating"
                );


                await loadUsers();


                setTimeout(() => {

                    refreshBtn.classList.remove(
                        "rotating"
                    );

                }, 500);

            }
        );

    }


    /* =====================================================
       ADD FRIEND
    ====================================================== */

    if (addFriendBtn) {

        addFriendBtn.addEventListener(
            "click",
            () => {

                if (searchInput) {

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });


                    setTimeout(() => {

                        searchInput.focus();

                    }, 350);

                }

            }
        );

    }


    /* =====================================================
       SCROLL TOP
    ====================================================== */

    window.addEventListener(
        "scroll",
        () => {

            if (!scrollTopBtn) {
                return;
            }


            if (
                window.scrollY > 400
            ) {

                scrollTopBtn.classList.remove(
                    "hidden"
                );

            } else {

                scrollTopBtn.classList.add(
                    "hidden"
                );

            }

        },
        {
            passive: true
        }
    );


    if (scrollTopBtn) {

        scrollTopBtn.addEventListener(
            "click",
            () => {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }


    /* =====================================================
       SKELETON
    ====================================================== */

    function showSkeleton() {

        if (usersSkeleton) {

            usersSkeleton.classList.remove(
                "hidden"
            );

        }

    }


    function hideSkeleton() {

        if (usersSkeleton) {

            usersSkeleton.classList.add(
                "hidden"
            );

        }

    }


    /* =====================================================
       AUTH
    ====================================================== */

    function initializeAuth() {

        if (
            typeof firebase === "undefined" ||
            !firebase.auth
        ) {

            loadUsers();

            return;
        }


        firebase
            .auth()
            .onAuthStateChanged(
                user => {

                    currentUser =
                        user || null;


                    loadUsers();

                }
            );

    }


    /* =====================================================
       START
    ====================================================== */

    initializeAuth();

})();