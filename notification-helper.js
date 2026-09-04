"use strict";

/* =========================================================
   VIEWORA NOTIFICATION HELPER
   Firebase Realtime Database
========================================================= */

window.VieworaNotifications = (() => {

    function ready() {
        return (
            typeof firebase !== "undefined" &&
            firebase.apps &&
            firebase.apps.length &&
            typeof db !== "undefined"
        );
    }

    function clean(value) {
        return value === undefined ||
               value === null
            ? ""
            : String(value).trim();
    }

    function validUID(uid) {
        uid = clean(uid);

        return uid.length > 0 &&
               uid !== "null" &&
               uid !== "undefined";
    }

    async function getUser(uid) {

        uid = clean(uid);

        if (!validUID(uid) || !ready()) {
            return {};
        }

        try {

            const snap = await db
                .ref("users/" + uid)
                .once("value");

            return snap.exists()
                ? snap.val() || {}
                : {};

        } catch (error) {

            console.warn(
                "Notification user read failed:",
                error
            );

            return {};
        }
    }

    async function create(options = {}) {

        if (!ready()) {
            return null;
        }

        const toUid =
            clean(options.toUid);

        const fromUid =
            clean(options.fromUid);

        const type =
            clean(options.type);

        if (!validUID(toUid)) {
            console.warn(
                "Notification skipped: receiver UID missing."
            );

            return null;
        }

        if (!validUID(fromUid)) {
            console.warn(
                "Notification skipped: sender UID missing."
            );

            return null;
        }

        if (toUid === fromUid) {
            return null;
        }

        if (!type) {
            return null;
        }

        try {

            const fromUser =
                await getUser(fromUid);

            const name =
                fromUser.name ||
                fromUser.fullName ||
                fromUser.displayName ||
                fromUser.username ||
                "Someone";

            const username =
                fromUser.username ||
                fromUser.userName ||
                fromUser.handle ||
                "";

            const avatar =
                fromUser.profilePhoto ||
                fromUser.profilePicture ||
                fromUser.photoURL ||
                fromUser.avatar ||
                "";

            let message =
                clean(options.message);

            if (!message) {

                switch (type) {

                    case "like":
                        message =
                            "liked your post";
                        break;

                    case "comment":
                        message =
                            "commented on your post";
                        break;

                    case "follow":
                        message =
                            "started following you";
                        break;

                    case "mention":
                        message =
                            "mentioned you in a story";
                        break;

                    case "story_reaction":
                        message =
                            "reacted to your story";
                        break;

                    case "story_reply":
                        message =
                            "replied to your story";
                        break;

                    default:
                        message =
                            "sent you a notification";
                }
            }

            const ref =
                db
                    .ref(
                        "notifications/" +
                        toUid
                    )
                    .push();

            const notification = {

                id:
                    ref.key,

                type,

                fromUid,

                fromName:
                    name,

                fromUsername:
                    username,

                fromAvatar:
                    avatar,

                message,

                read:
                    false,

                createdAt:
                    firebase.database.ServerValue.TIMESTAMP

            };

            if (options.postId) {

                notification.postId =
                    clean(options.postId);

            }

            if (options.storyId) {

                notification.storyId =
                    clean(options.storyId);

            }

            if (options.commentId) {

                notification.commentId =
                    clean(options.commentId);

            }

            if (options.reaction) {

                notification.reaction =
                    clean(options.reaction);

            }

            if (options.replyText) {

                notification.replyText =
                    clean(options.replyText)
                        .slice(0, 300);

            }

            if (options.mentionText) {

                notification.mentionText =
                    clean(options.mentionText)
                        .slice(0, 300);

            }

            await ref.set(notification);

            return ref.key;

        } catch (error) {

            console.error(
                "Notification create failed:",
                error
            );

            return null;
        }
    }

    async function like(
        postId,
        postOwnerUid,
        fromUid
    ) {

        return create({

            type: "like",

            toUid:
                postOwnerUid,

            fromUid,

            postId

        });
    }

    async function comment(
        postId,
        postOwnerUid,
        fromUid,
        commentId,
        commentText
    ) {

        return create({

            type: "comment",

            toUid:
                postOwnerUid,

            fromUid,

            postId,

            commentId,

            message:
                "commented on your post",

            replyText:
                commentText

        });
    }

    async function follow(
        targetUid,
        fromUid
    ) {

        return create({

            type: "follow",

            toUid:
                targetUid,

            fromUid,

            message:
                "started following you"

        });
    }

    async function mention(
        storyOwnerUid,
        fromUid,
        storyId,
        mentionText
    ) {

        return create({

            type: "mention",

            toUid:
                storyOwnerUid,

            fromUid,

            storyId,

            mentionText,

            message:
                "mentioned you in a story"

        });
    }

    async function storyReaction(
        storyOwnerUid,
        fromUid,
        storyId,
        reaction
    ) {

        return create({

            type: "story_reaction",

            toUid:
                storyOwnerUid,

            fromUid,

            storyId,

            reaction,

            message:
                "reacted to your story"

        });
    }

    async function storyReply(
        storyOwnerUid,
        fromUid,
        storyId,
        replyText
    ) {

        return create({

            type: "story_reply",

            toUid:
                storyOwnerUid,

            fromUid,

            storyId,

            replyText,

            message:
                "replied to your story"

        });
    }

    return {

        create,
        like,
        comment,
        follow,
        mention,
        storyReaction,
        storyReply

    };

})();